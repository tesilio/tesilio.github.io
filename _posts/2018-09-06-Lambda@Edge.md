---
layout: posts
title: AWS Lambda@Edge 적용기
description: 람다 엣지를 사용해보자.
tags: [aws, lambda, cloudFront, lambda@edge, nodejs, javascript]
---

***

# 1. AWS Lambda@Edge란?
- Cloud Front용 Lambda를 **Lambda@Edge**라고 한다.
- Cloud Front 이벤트 타입에 연결되어 실행된다.
![개념](https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/images/cloudfront-events-that-trigger-lambda-functions.png)
- 자세한 정보는 [AWS 공식문서](https://docs.aws.amazon.com/ko_kr/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)를 참고하는 것이 좋다.

***

# 2. 적용이유
origin을 S3로 두고있는 Cloud Front의 트래픽 비용절감을 위해 사용했다.
S3에 적재되어 있는 객체들 대부분이 jpg이다. 따라서 압축이나 리사이즈를 통해 최소 30% 이상 비용절감이 기대되었다.

***

# 3. 요구 및 제한사항([AWS 공식문서](https://docs.aws.amazon.com/ko_kr/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html))
**해당 항목들 때문에 적용하는데 어려움도 있었고, 아쉬움도 남았다.**
1. **Nodejs**만 사용가능 (v6.10, v8.10)
2. 오리진 요청/응답 이벤트: 헤더 및 본문을 포함하여 Lambda 함수에서 생성되는 응답의 크기 **1MB** [(AWS 공식문서)](https://docs.aws.amazon.com/ko_kr/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-lambda-at-edge)
> 해당 제한사항 때문에 압축 혹은 리사이즈 한 이미지의 크기가 1MB가 넘으면 에러가 발생했다.
> 그래서 프로세싱한 이미지를 S3에 저장하고 요청 uri를 변경하는 로직으로 진행하였다.
3. 환경변수 사용불가
> S3 Bucket명 이라던지 이미지 압축률 같은 것들을 변수처리 하지 못해 소스코드상에 적용시켰다.

***

# 4. 준비물
- 로컬 머신은 **Mac OS** 이다. 하지만 다른 OS여도 상관없다.
- docker: [초보를 위한 도커 안내서-설치하고 컨테이너 실행하기-Subicura](https://subicura.com/2017/01/19/docker-guide-for-beginners-2.html)
- Nodejs(v8.10): [처음 시작하는 Node.js 개발-설치 및 버전 관리(NVM, n)-HEROPY](https://heropy.blog/2018/02/17/node-js-install/)
- npm

***

# 5. AWS 콘솔에서 Lambda 함수 생성

1. [여기](https://console.aws.amazon.com/lambda/home?region=us-east-1#/create) 에 간다.
![함수생성화면](/assets/images/lambda@edge1.jpg)
2. 적당한 이름을 입력한다.
3. 런타임은 **Node.js 8.10**으로 한다.
4. S3에대한 모든 권한이 필요하기 때문에 역할에 대한 추가 정책이 필요하다.
5. 역할 > '사용자 지정 역할 생성'을 선택한다.
6. 새탭이 열리면 역할 이름을 정하고 '정책 문서 보기' > '편집'을 누른다.
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Resource": "arn:aws:logs:*:*:*"
        },
        {
          "Effect": "Allow",
          "Action": "s3:*",
          "Resource": "*"
        }
      ]
    }
    ```
이렇게 입력 후 '허용'을 누른다.
7. 그리고 일단 함수를 생성한다.
8. 역할에 대한 신뢰 관계를 수정해야한다. [여기](https://console.aws.amazon.com/iam/home?region=us-east-1#/roles)로 간다.
9. 방금 생성 한 역할을 찾아 '신뢰 관계' 탭 클릭 > '신뢰 관계 편집' 을 클릭힌다.
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": [
              "edgelambda.amazonaws.com",
              "lambda.amazonaws.com"
            ]
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }
    ```
이렇게 입력 후 '신뢰 정책 업데이트'를 누른다.
10. 이러면 함수생성은 끝이다. 이제 실제로 동작하게끔 만들어보자.

***

# 6. Cloud Front 이벤트 타입
실제 코드를 작성하기 전에 어느 이벤트타입에서 동작해야 하는지 정해야 한다.
이 포스트에서는 **origin-request**에 연결 할 함수를 만들 것이다. 

# 7. Handler
기본적으로 생성 된 람다 함수의 handler는 index.handler이다. 따로 변경하지는 않겠다.

이미지 프로세싱을 위해 **sharp**라는 모듈을 사용한다. 
1. 프로젝트에 sharp를 설치한다.
```
npm install sharp
```
2. 로컬에서 테스트 및 개발을 위해 aws-sdk도 설치한다. 람다함수에 기본 내장되어 있어서, 실제 배포시엔 node_modules에 포함 될 필요가 없다. 
```
npm install aws-sdk
```
3. index.js
```javascript
    const AWS = require('aws-sdk');
    const SHARP = require('sharp');
    const S3 = new AWS.S3({
        signatureVersion: 'v4',
    });
    const BUCKET = '버킷명';
    exports.handler = (event, context, callback) => {
        let cf = event.Records[0].cf;
        let originRequest = cf.request;
        let decodedUri = decodeURIComponent(originRequest.uri);
        let uriMatch = decodedUri.match(/\/(.*)\.(.*)/);
        let [originKey, imageName, extension] = uriMatch;
        originKey = decodedUri.replace(/^\//, "");
        S3.getObject({Bucket: BUCKET, Key: originKey}).promise()
            .then(getResponse => {
                let sharpObject = SHARP(getResponse.Body);
                let newKey = "ProcessedImages/" + originKey;
                sharpObject.jpeg({quality: 90}).toBuffer()
                    .then(buffer => {
                        S3.putObject({
                            Body: buffer,
                            Bucket: BUCKET,
                            ContentType: 'image/jpeg',
                            Key: newKey,
                            StorageClass: 'STANDARD'
                        }).promise()
                            .catch(putObjectErr => {
                                throw putObjectErr;
                            });
                    })
                    .catch(toBufferErr => {
                        throw toBufferErr;
                    });
    
                let newUri = "/" + encodeURIComponent(newKey);
                originRequest.uri = newUri;  // 바뀐 uri 로 변경!
                callback(null, originRequest);
            })
            .catch(error => {
                console.log(error);
                callback(null, originRequest);
            });
    
    };
```
    동작하는 최소한의 참고용 코드이다. 흐름은 이렇다.
    - **event**변수에 request 정보가 담겨있다. 거기서 uri를 얻는다.
    - S3 > 버킷에 해당 객체를 조회한다.
    - sharp를 이용하여 프로세싱한다.
    - S3 > 버킷에 ProcessedImages/ 라는 폴더 하위에 새로 저장한다.
    - /ProcessedImages/{파일명}.jpg 로 request.uri를 바꾼다.
    - 바뀐 request를 callback함수에 전달하여 CF가 S3에 요청한다.

***

# 7. Lambda 배포 패키지 만들기
배포패키지(zip)를 람다가 작동할 환경에 맞게 만들어야 한단다.
[sharp 설치 문서](http://sharp.pixelplumbing.com/en/stable/install/#aws-lambda).

1. node_modules를 지운다.
```
$ rm -rf node_modules
```
2. package.json 에 aws-sdk를 지운다.
3. docker를 이용하여 배포패키지용 node_modules를 빌드한다.
```
$ docker run -v "$PWD":/var/task lambci/lambda:build-nodejs8.10 npm install
```
4. 해당 node_modules 와 index.js를 함께 zip으로 압축하면 된다.

***

# 8. 배포하기
드디어 배포 할 시간이다.

1. 생성한 람다함수 콘솔로 간다.
2. 함수 코드 > 코드 입력 유형 > .ZIP 파일 업로드를 선택 후 업로드 한다.
    - ![업로드참고](/assets/images/lambda@edge1.jpg)
3. 새 버전을 게시한다.
    - ![버전게시](/assets/images/lambda@edge2.jpg)
4. Designer 에 CloudFront를 추가한다.
    - ![버전게시](/assets/images/lambda@edge3.jpg)
5. 트리거 구성에서 배포(Distribution)를 선택한다.
6. CloudFront 이벤트는 오리진 요청(origin-request)으로 한다.
7. 추가를 누르면 해당 Distribution의 배포가 시작된다.

***

# 9. 마무리
index.js의 코드나 람다 함수 설정에 대한 세세한 부분은 각자의 상황에 맞춰 적용하면 되겠다.
회사 프로젝트에 적용한지 얼마 되진 않았지만, Cloud Front 트래픽 절감에 효과를 보이고 있다.

이 포스트가 누군가에게 조그마한 도움이 되길 바란다.

***

*잘못 된 정보에 대한 지적, 더 좋은 방법에 대한 의견 등은 언제나 많이많이 환영합니다.😆*
