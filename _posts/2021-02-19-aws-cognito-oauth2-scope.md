---
layout: posts
title: AWS Cognito 및 OAuth2 Scope를 사용하여 API Gateway 보안 강화하기
description: API Gateway의 API가 권한부여자로 Cognito의 사용자 풀을 사용하는 구성설정을 간단히 알아보자
tags: [aws, api-gateway, cognito, oauth2]
---

API Gateway의 API가 권한부여자로 Cognito의 사용자 풀을 사용하는 구성에서, 사용자가 직접 로그인 하지 않는 클라이언트 앱에 대한 인증 및 권한 부여를 해야 하는 상황이 있다. 이 경우에 어떻게
설정해야 하는 지 알아보자.

Cognito 사용자 풀, API 그리고 실행할 Lambda 함수가 있다는 가정 하에 작성했다.

---

## 설정 및 테스트

### 1. API Gateway 리소스 생성

![1](/assets/images/2021-02-19/1.png)

![2](/assets/images/2021-02-19/2.png)

### 2. API Gateway 메서드 생성

![3](/assets/images/2021-02-19/3.png)

![4](/assets/images/2021-02-19/4.png)

![5](/assets/images/2021-02-19/5.png)

![6](/assets/images/2021-02-19/6.png)

메서드 생성이 완료되면 아래와 같은 화면을 볼 수 있다.

![7](/assets/images/2021-02-19/7.png)

### 3. Cognito 앱 클라이언트 생성

Cognito → 사용자 풀 → 특정 사용자 풀 화면에서 아래와 같이 진행한다. 클라이언트 보안키 생성 체크박스에 체크가 돼 있는지 확인한다.

![8](/assets/images/2021-02-19/8.png)

![9](/assets/images/2021-02-19/9.png)

생성을 완료 했다면, 아래와 같이 아이디와 보안키를 확인할 수 있다.

![10](/assets/images/2021-02-19/10.png)

### 4. Cognito 도메인 이름 설정

만약 설정이 되어 있지 않다면 원하는 이름으로 설정한다.

![11](/assets/images/2021-02-19/11.png)

### 5. Cognito 리소스 서버 추가 및 사용자 지정 범위 지정

/tests 리소스엔 메서드가 GET 하나 뿐이니 범위도 일단 하나만 생성한다.

![12](/assets/images/2021-02-19/12.png)

### 6. Cognito 앱 클라이언트 설정

Cognito user Pool을 체크한다. 이 클라이언트 앱은 로그인하지 않는 앱(서버 to 서버)이기 때문에 Client credentials을 체크한다. 그리고 아까 생성한 사용자 지정 범위도 체크하여
저장한다.

![13](/assets/images/2021-02-19/13.png)

![14](/assets/images/2021-02-19/14.png)

### 7. access_token 발급 테스트

Cognito에 대한 설정은 끝났으니, 정상적으로 access_token이 되는 지 확인하자.

```
// 요청
POST /oauth2/token?grant_type=client_credentials HTTP/1.1
Host: test123412414.auth.ap-northeast-2.amazoncognito.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic Base64Encode(<client_id>:<client_secret>)
```

```json
// 결과
{
  "access_token": "eyJraWQiOiJqT1NSS3JDZTlXY0hTRjF5WGx4ZnoyYmV4eGJweVN3aldVcFwvTzFMVnBXQT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI0aDE2ZTFsMGtnb3RsYTFjMGo4dnZqZ2l0dCIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiY29tLnRlc3QudGVzdFwvdGVzdC5yZWFkIiwiYXV0aF90aW1lIjoxNjEzNzA0ODE0LCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtbm9ydGhlYXN0LTIuYW1hem9uYXdzLmNvbVwvYXAtbm9ydGhlYXN0LTJfT0lBS0QzdVVpIiwiZXhwIjoxNjEzNzA4NDE0LCJpYXQiOjE2MTM3MDQ4MTQsInZlcnNpb24iOjIsImp0aSI6IjUyYzVhYWRjLWM0YTItNDRiMS05NTA0LTExMWEwOWQ4MGFhNiIsImNsaWVudF9pZCI6IjRoMTZlMWwwa2dvdGxhMWMwajh2dmpnaXR0In0.WugU1uubN5poT_r1vnJp65lIm8a9O_uRerCRDUwfzW1s_43ljfAlJv1RwJd3XN3h9xBWyRKnoBoP5TfYoqlds5w-1YoMMjPb-hmExiXGxVb2clg4P6Lg76W-OKZnxmsvOSZMfRb49EB-rXYVxVvLW1OWsNWv2TT68KUJcjc3xj6koLogOw2YTrN-Q96YtGxZgXOv07n6b6lf-1vrzRniuT5OBn3FWpdkPKzZgSEzuef_Y-9FluJyGybsvFvttq_BnHWysfyHziVMF43WAziX-UeTuBvRdybtKVqWy5QdK36TnT0oorNZzn613T9HRFFbdk1-D_HKmb6jNjIa0eL3Tg",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

1시간짜리 access_token이 오는것이 확인된다. 유효시간은 앱 클라이언트 설정에서 변경할 수 있다.

### 8. API Gateway 권한 부여자 생성

아까 설정한 API로 돌아가서 Cognito로 권한 부여자를 설정한다. 토큰 원본은 헤더의 무슨 키값으로 토큰을 받을지 지정하는 항목이다. `Authorization` 으로 작성한다.

![15](/assets/images/2021-02-19/15.png)

### 9. API Gateway 메서드에 메서드 요청 설정

![16](/assets/images/2021-02-19/16.png)

![17](/assets/images/2021-02-19/17.png)

만약 목록에 생성한 권한부여자가 나타나지 않는다면 새로고침 후 진행하자. 승인을 생성한 권한 부여자로 지정 후, 허용된 OAuth 범위를 추가하면 된다. `<Identifier>/<Name>` 형식이다.
생성한대로 `com.test.test/test.read` 로 입력한다.

![18](/assets/images/2021-02-19/18.png)

### 10. API Gateway API 배포

거의 다 왔다! 배포 후 테스트를 해보자.

![19](/assets/images/2021-02-19/19.png)

![20](/assets/images/2021-02-19/20.png)

그럼 아래와 같이 API URL이 나온다. 거기에 /tests 엔드포인트로 테스트 요청을 해보자.

![21](/assets/images/2021-02-19/21.png)

### 11. API 요청 테스트

```
// 요청
GET /dev/tests HTTP/1.1
Host: 1xv8w3ztyb.execute-api.ap-northeast-2.amazonaws.com
Authorization: eyJraWQiOiJqT1NSS3JDZTlXY0hTR...이하생략
```

```json
// 응답
{
  "code": "00000",
  "message": "success"
}
```

JSON을 응답해주는 Lambda 함수에서 정상적인 응답값을 확인 할 수 있다. 만약 `Authorization` 을 누락하거나 잘못된 토큰값으로 요청한다면 `401 Unauthorized` 응답이 온다.

---

## 마무리

Cognito를 권한 부여자로 활용하여 API의 보안을 설정하는 방법을 알아보았다.

이렇게 클라이언트 앱에서 access_token을 이용하여 API를 사용한다면 보안에 도움이 될 것이다. 그리고 실제 사용하는 상황에서는 리소스와 메서드별로 다양하게 리소스 허용 범위를 정하여 유연하게 운영할
수도 있다.

---

## 참고

- [https://aws.amazon.com/ko/premiumsupport/knowledge-center/cognito-custom-scopes-api-gateway/](https://aws.amazon.com/ko/premiumsupport/knowledge-center/cognito-custom-scopes-api-gateway/)
- [https://awskarthik82.medium.com/part-1-securing-aws-api-gateway-using-aws-cognito-oauth2-scopes-410e7fb4a4c0](https://awskarthik82.medium.com/part-1-securing-aws-api-gateway-using-aws-cognito-oauth2-scopes-410e7fb4a4c0)
- [http://blog.weirdx.io/post/39955](http://blog.weirdx.io/post/39955)
