---
layout: posts
title: AWS Lambda + AWS X-Ray + Sequelize
description: AWS Lambda와 X-Ray를 사용해 모니터링을 어떻게 하는지 간단하게 알아보자
tags: [aws, lambda, x-ray, nodejs, sequelize, postgresql]
---

## AWS X-Ray란?

AWS X-Ray는 애플리케이션이 처리하는 요청에 대한 데이터를 수집하는 서비스이다.

API Gateway, Lambda, Elastic Load Balacing 등 여러 AWS 서비스와 통합이 가능하다. 이 글은 AWS 서비스 중 Lambda에 적용한 것에 대한 내용이다.

![1](/assets/images/2020-10-19/1.png)

---

## AWS X-Ray의 장점

1. 에러나 지연 등의 문제를 쉽게 식별할 수 있다.
2. AWS 콘솔에서 시각화된 정보를 제공하여 애플리케이션에 대한 통찰을 얻을 수 있다.
3. AWS SDK, 데이터베이스 쿼리, HTTP 통신 등을 쉽게 추적할 수 있다.

디버깅에 드는 비용을 생각하면, 1번 하나만 봐도 적용할 이유가 충분하다.

---

## AWS Lambda에 X-Ray를 사용할 수 있게 설정하기

1. 사용할 Lambda 함수에서 X-Ray tracing 옵션을 활성화 해야한다. 다음은 AWS 콘솔을 이용하는 방법과 Serverless Framework를 사용하는 경우의 설정 방법이다.

    - AWS 콘솔 → Lambda → 함수 → 적용할 Lambda 함수 → 모니터링 도구 편집 → 활성 추적 → 저장

    ![2](/assets/images/2020-10-19/2.png)

    - Serverless Framework

        ```yaml
        # serverless.yml

        provider:
          name: aws
          tracing:
            apiGateway: true  # 선택사항: API Gateway도 tracing 되길 원하기 때문에 true로 활성화
            lambda: true
        ```

2. aws-xray-sdk 설치

    ```bash
    npm install aws-xray-sdk
    ```

Lambda에 X-Ray tracing 옵션을 활성화 하고, aws-xray-sdk 모듈을 설치해주면 AWS X-Ray를 사용할 수 있는 준비가 완료된다.

---

## AWS Lambda에서 Sequelize(PostgreSQL)에 적용하기

`sequelize` 객체 생성 시 옵션에 `dialectModule` 을 지정해야 한다.

```jsx
const AWSXRay = require('aws-xray-sdk');

const dbConfig = {
  options: {
    dialect: 'postgres',
    dialectModule: AWSXRay.capturePostgres(require('pg')),  // pg 모듈을 Capture
  },
};

const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, dbConfig.options);

exports.handler = async function (event, context, callback) {
  const dbResult = await sequelize.models.SomeModel.findAll({/* options */ });
...
...
}
```

`sequelize` 객체를 사용하여 질의된 Query가 샘플링 되며, 아래와 같은 형태를 AWS X-Ray 콘솔에서 확인할 수 있다.

![3](/assets/images/2020-10-19/3.png)

`studio_dev@`로 시작하는 항목이 `sequelize` 객체를 사용한 Query에 대한 샘플링이다.

---

## AWS Lambda에서 AWS SDK에 적용하기

`aws-sdk` 를 `aws-xray-sdk` 로 Capture하면 된다.

```jsx
const AWSXRay = require('aws-xray-sdk');

const dbConfig = {
  options: {
    dialect: 'postgres',
    dialectModule: AWSXRay.capturePostgres(require('pg')),
  },
};

const AWS = AWSXRay.captureAWS(require('aws-sdk'));  // aws-sdk 모듈을 Capture
const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, dbConfig.options);

exports.handler = async function (event, context, callback) {
  const dbResult = await sequelize.models.SomeModel.findAll({/* options */ });
...
...
  AWS.config.update({ region: 'ap-northeast-2' });
  const sqs = new AWS.SQS();
  const params = {
    DelaySeconds: 0,
    MessageAttributes: {
      'Hello': {
        DataType: 'String',
        StringValue: 'World!',
      },
    },
    MessageBody: JSON.stringify(value),
    QueueUrl: process.env.SQS_API_LOG_QUEUE_URL,
  };
  await sqs.sendMessage(params).promise();
...
...
}

```

Capture된 AWS 객체를 사용하여 `SQS`에 메시지를 하나 보냈다.

![4](/assets/images/2020-10-19/4.png)

`SQS` 항목이 추가된 것을 확인할 수 있다. 총 125ms 중 41ms가 소요됐다.

---

## AWS Lambda에서 작성한 함수에 적용하기

직접 작성한 함수에도 X-Ray로 Capture해 tracing 할 수 있다. X-Ray에는 세그먼트라는 것이 있는데, 기록에 대한 단위, 묶음, Labeling 정도의 개념으로 이해 했다. 이
세그먼트를 활용하여 원하는 구간이나 함수를 나누어 기록한다.

```jsx
const AWSXRay = require('aws-xray-sdk');

const dbConfig = {
  options: {
    dialect: 'postgres',
    dialectModule: AWSXRay.capturePostgres(require('pg')),
  },
};

const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, dbConfig.options);

async function eventSetter(event) {
  return AWSXRay.captureAsyncFunc('eventSetter', async subsegment => {  // eventSetter 라는 이름의 하위 세그먼트로 Capture
    try {
      event.result = await sequelize.models.SomeModel.findAll({/* options */ });
      subsegment.close();
      return event;
    } catch (e) {
      subsegment.addError(e);  // 에러 처리
      subsegment.close();
      throw e;
    }
  });
}

async function logger(event) {
  return AWSXRay.captureAsyncFunc('logger', async subsegment => {  // logger 라는 이름의 하위 세그먼트로 Capture
    try {
      console.log(event);
      AWS.config.update({ region: 'ap-northeast-2' });
      const sqs = new AWS.SQS();
      const params = {
        DelaySeconds: 0,
        MessageAttributes: {
          'Hello': {
            DataType: 'String',
            StringValue: 'World!',
          },
        },
        MessageBody: JSON.stringify(value),
        QueueUrl: process.env.SQS_API_LOG_QUEUE_URL,
      };
      await sqs.sendMessage(params).promise();
      subsegment.close();
      return true;
    } catch (e) {
      subsegment.addError(e);  // 에러 처리
      subsegment.close();
      throw e;
    }

  });
}

exports.handler = async function (event, context, callback) {
  event = await eventSetter(event);
  const loggingResult = await logger(event);
...
...
}
```

eventSetter, logger 함수에 각자 이름을 붙이고 하위 세그먼트로 지정하여 Capture 했다. 아래는 그 결과이다.

![5](/assets/images/2020-10-19/5.png)

세그먼트 별로 구분되어 샘플링 됨을 확인할 수 있다. 이제 어떤 함수에서 문제가 생기는지 알기 쉬워졌다.

---

## HTTP 에 적용하기

X-Ray는 Outbound HTTP 통신에도 Capture를 할 수 있다. `captureHTTPsGlobal` 이라는 메서드를 사용하면 된다.
아래는 [randomuser.me](http://randomuser.me) 라는 API를 `axios` 를 이용하여 GET 요청하는 예제이다.

```jsx
const AWSXRay = require('aws-xray-sdk');

AWSXRay.captureHTTPsGlobal(require('http'));  // http 모듈 Capture
AWSXRay.captureHTTPsGlobal(require('https'));  // https 모듈 Capture
AWSXRay.captureHTTPsGlobal(require('http2'));  // htt2 모듈 Capture

const dbConfig = {
  options: {
    dialect: 'postgres',
    dialectModule: AWSXRay.capturePostgres(require('pg')),
  },
};

const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, dbConfig.options);

async function eventSetter(event) {
  return AWSXRay.captureAsyncFunc('eventSetter', async subsegment => {  // eventSetter 라는 이름의 하위 세그먼트로 Capture
    try {
      event.result = await sequelize.models.SomeModel.findAll({/* options */ });
      subsegment.close();
      return event;
    } catch (e) {
      subsegment.addError(e);  // 에러 처리
      subsegment.close();
      throw e;
    }
  });
}

async function logger(event) {
  return AWSXRay.captureAsyncFunc('logger', async subsegment => {  // logger 라는 이름의 하위 세그먼트로 Capture
    try {
      console.log(event);
      AWS.config.update({ region: 'ap-northeast-2' });
      const sqs = new AWS.SQS();
      const params = {
        DelaySeconds: 0,
        MessageAttributes: {
          'Hello': {
            DataType: 'String',
            StringValue: 'World!',
          },
        },
        MessageBody: JSON.stringify(value),
        QueueUrl: process.env.SQS_API_LOG_QUEUE_URL,
      };
      await sqs.sendMessage(params).promise();
      subsegment.close();
      return true;
    } catch (e) {
      subsegment.addError(e);  // 에러 처리
      subsegment.close();
      throw e;
    }

  });
}

exports.handler = async function (event, context, callback) {
  event = await eventSetter(event);
  const loggingResult = await logger(event);
...
  const getResult = await axios.get('https://randomuser.me/api/');
...
}
```

[randomuser.me](http://randomuser.me) 라는 이름으로 샘플링 된 것을 확인할 수 있다.

![6](/assets/images/2020-10-19/6.png)

---

## 샘플링 규칙 추가하기

기본적으로 X-Ray는 1초에 한 번, 그 후부터는 5% 고정 비율로 샘플링 한다. 만약 1초동안 Lambda 함수를 101번 실행하면 X-Ray에 샘플링 되는 건 여섯번이다. 이 규칙의 샘플링 양이 너무 적다면,
새로운 샘플링 규칙을 추가하면 된다.

1. AWS X-Ray 콘솔 → 구성 → 샘플링 → 샘플링 규칙 생성

   ![7](/assets/images/2020-10-19/7.png)

2. 이름, 우선 순위, 리저버 크기, 고정 비율, 일치 기준 등 기입 → 샘플링 규칙 생성

   ![8](/assets/images/2020-10-19/8.png)

초당 200번의 요청까지 샘플링하고 그 후엔 50%만 샘플링 하는 규칙이다. 우선 순위의 값이 낮을수록 샘플링 규칙의 순서가 우선한다.

해놓고 드는 걱정은 요금이다. 다행히 매달 1십만 개의 트레이스가 무료이다. 서울리전 기준으로 프리티어를 초과한 1백만 개당 5.00 USD가 발생한다. 한도를 적절한 값으로 상황에 맞게 수정하면 될 것
같다.

---

## Troubleshooting

- `sequelize` 객체 생성 시 옵션에 `dialectModule` 지정 후 `sequelize` 객체 사용 시 → `Error: Cannot find module 'pg-native'` 에러
    - pg 모듈을 8버전 이상으로 업데이트하여 해결했다.

---

## 결론

이 정도만 해도 정시 퇴근 가능성이 높아지니, 가급적 적용하면 좋을 것 같다. 부족한 글 읽어주셔서 감사하다.

---

## 참고

- [AWS X-Ray 개발자 가이드](https://docs.aws.amazon.com/ko_kr/xray/latest/devguide/aws-xray.html)
- [AWS X-Ray FAQ](https://aws.amazon.com/ko/xray/faqs/)
- [dialectModule](https://github.com/aws/aws-xray-sdk-node/issues/271#issuecomment-692819044)
- [pg-native 에러](https://github.com/sequelize/sequelize/issues/3781)
- Deep
  dive: [https://itnext.io/a-deep-dive-into-serverless-tracing-with-aws-x-ray-lambda-5ff1821c3c70](https://itnext.io/a-deep-dive-into-serverless-tracing-with-aws-x-ray-lambda-5ff1821c3c70)
- [오류 처리](https://forums.aws.amazon.com/thread.jspa?threadID=282800&tstart=0)
