---
layout: posts
title: AWS Lambda + Sequelize(v6) + PostgreSQL 환경에서 커넥션 풀 관리
description: AWS Lambda 환경에서 PostgreSQL + Sequelize 사용 시 커넥션 풀에 대한 삽질을 작성해보았다.
tags: [postgresql, aws, lambda, sequelize, nodejs]
---

AWS Lambda + Sequelize(v6) + PostgreSQL로 구성한 환경에서 발생한 DB Connection 관련 문제와 그 해결 과정을 기록한 글이다. 해결 방법은 정답이 아니며, 더 나은 방법을 함께 고민하고 공유하면 좋겠다.

---

## 바쁜 분들을 위한 네줄스포

- Lambda 전역객체 재사용을 잘하자.
- 다 쓴 DB Connection은 끊어주자.
- 생성한 sequelize 객체를 일정 기간 이상 재사용하면 ECONNRESET 에러가 발생한다.
- DB Connection Pool 옵션을 잘 조정하자.

---

## 첫 번째 문제

### Lambda 호출 시마다 Sequelize 객체를 생성하여 오버헤드 발생

이 문제를 이해하려면, Lambda 특성에 대해 어느정도는 알아야 한다. 처음 Lambda를 호출하면 아래 그림과 같은 과정이 일어난다.

![참고이미지](/assets/images/lambda-request-lifecycle.png)
출처: [Become a Serverless Black Belt: Optimizing Your Serverless Applications - SRV401 - re:Invent 2017](https://www.slideshare.net/AmazonWebServices/become-a-serverless-black-belt-optimizing-your-serverless-applications-srv401-reinvent-2017)

1. 소스코드를 다운로드 하고
2. 새로운 컨테이너가 시작되고
3. 언어 런타임을 구성하고
4. 코드가 동작한다.

다시 요청하면 4번 부분이 동작한다. 코드 수준에서 Lambda는 최초 실행 시 구성되는 전역환경(3번)과, 요청할 때마다 실행되는 핸들러(4번)로 나뉘어져 있다. 처음 이런 특성을 몰랐을 땐 기대한대로
동작하지 않아 당황했던 기억이 있다. 아래 코드를 보면 이해할 수 있다.

```jsx
// 최초 실행 시에만 동작하는 전역환경
let GLOBAL_COUNT = 0;
GLOBAL_COUNT -= 1;

exports.handler = async (event, context) => {  // 호출할 때마다 실행되는 부분
  GLOBAL_COUNT += 1;
  console.log(`GLOBAL_COUNT: ${GLOBAL_COUNT}`);  // 호출할 때마다 1씩 증가돼 로깅.
  return {
    statusCode: 200,
    body: JSON.stringify({
      global_count: GLOBAL_COUNT,
    }),
  };
};
```

호출할 때마다 GLOBAL_COUNT 변수가 0인 것을 기대했지만 0, 1, 2, 3, 4...로 1씩 증가한다. 원하는 결과값을 얻으려면 handler(이하 핸들러)함수에 작성해야 한다.

아래는 수정한 코드이다.

```jsx
// 최초 실행 시에만 동작하는 전역환경
let GLOBAL_COUNT = 0;

exports.handler = async (event, context) => {  // 호출할 때마다 실행되는 부분
  GLOBAL_COUNT -= 1;
  GLOBAL_COUNT += 1;
  console.log(`GLOBAL_COUNT: ${GLOBAL_COUNT}`);  // 호출할 때마다 1씩 증감돼 로깅.
  return {
    statusCode: 200,
    body: JSON.stringify({
      global_count: GLOBAL_COUNT,
    }),
  };
};
```

매 요청마다 증감이 되어 GLOBAL_COUNT가 0임을 확인할 수 있다.

Lambda 컨테이너가 실행되고 있는 한, 전역환경에 선언된 객체는 재사용이 가능하다. 여러번의 테스트 결과, 후속 요청이 없다면 Lambda 컨테이너가 실행되는 기간은 대략 5~10분으로 추정된다. 그러나 후속
요청이 있다면, 더 오랜 기간 Lambda 컨테이너를 사용할 수 있다. Lambda 컨테이너의 정확한 생명주기는 모른다. ~~AWS만 안다.~~

그럼, 아래 코드를 보며 첫 번째 문제가 왜 발생하는지 알아보자.

```jsx
exports.handler = async (event, context) => {  // 호출할 때마다 실행되는 부분
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize({/** options **/ });
  const data = await sequelize.models.SomeModel.someMethod({/** options **/ });
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
  };
};
```

sequelize 객체를 생성하여 변수에 할당하는 순간, 앱은 DB와 Connection을 맺는다. 위와 같이 핸들러 함수에 구현되어 있다면 매 호출 마다 그 작업을 하기에 응답속도가 느리다. 그로 인해, 더
많은 비용이 발생하며 사용자에게 안 좋은 경험을 제공한다.

그래서 sequelize 객체를 생성하는 구문을 다음과 같이 전역에 선언 했다.

```jsx
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({/** options **/ });

exports.handler = async (event, context) => {  // 호출할 때마다 실행되는 부분
  const data = await sequelize.models.SomeModel.someMethod({/** options **/ });
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
  };
};
```

최초 요청 시에만 sequelize 객체를 생성한다. 후속 요청 건 부터는 sequelize 객체를 재사용 한다. 문제의 코드보다 응답이 더 빨라졌다.

이처럼 sequelize 같은 ORM 객체 뿐만 아니라, 재사용 할 수 있는 객체는 전역에 선언해두고 사용하는 것이 성능향상 측면에서 바람직하다.

> 또한, Lambda 함수를 4분 간격으로 호출하고 있다. Lambda 컨테이너를 재사용 할 수 있는 준비된(Warm) 상태로 두기 위함이다.

---

## 두 번째 문제

### API 요청이 급증할 경우, DB Connection 값이 증가 후 일정 기간 유지됨에 따라 새로운 연결이 불가하여 에러 발생

이 문제는 첫 번째 문제와 이어진다. 키워드는 **`일정 기간 유지됨`** 이다. Lambda는 동시에 많은 요청이 들어오면 설정 된 동시성 한도내에서 Lambda 컨테이너가 병렬로 실행된다. 그러면
Lambda 컨테이너 수 만큼 DB Connection이 열린다. 여기까지는 괜찮다. 그런데 비즈니스 로직이 끝난 뒤에도 열린 DB Connection이 끊기지 않아 문제가 발생한다. 핸들러함수는 종료 됐지만
Lambda 컨테이너는 실행되고 있기 때문이다.

아래는 첫 번째 문제를 해결한 예제 코드이다.

```jsx
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({/** options **/ });  // DB Connection Open!

exports.handler = async (event, context) => {  // 호출할 때마다 실행되는 부분
  const data = await sequelize.models.SomeModel.someMethod({/** options **/ });
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
  };
};
```

전역에 선언된 sequelize 변수가 DB Connection을 열었다. Lambda 컨테이너가 실행되고 있다면 핸들러 함수가 종료돼도 DB Connection은 열린 상태이다.

문제를 해결하기 위해 시도해 본 방법이 두가지 있다.

첫 번째, 전역에 선언된 sequelize를 핸들러 함수 안으로 옮긴다.

```jsx
// DB Connection을 끊지 않은 문제의 첫 번째 해결 시도 예제

const { Sequelize } = require('sequelize');

exports.handler = async (event, context) => {
  try {
    const sequelize = new Sequelize({/** options **/ });  // DB Connection open
    const data = await sequelize.models.SomeModel({/** options **/ });  // 비즈니스 로직
  } catch (e) {
    throw e;
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
  };
};
```

이렇게 수정하면 두 번째 문제는 해결된다. 하지만 매 요청 시 sequelize 객체를 생성해서 오버헤드가 발생한다. 200ms 걸릴 게 2s가 된다. 그럼 다시 첫 번째 문제로 돌아가는 셈이다.

두 번째, 전역에 선언된 sequelize 객체에 DB Connection을 다시 연결한다. 그리고 return 구문 전에 DB Connection을 끊어준다.

```jsx
// DB Connection을 닫지 않은 문제의 두 번째 해결 시도 예제

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({/** options **/ });  // DB Connection open

exports.handler = async (event, context) => {
  try {
    await sequelize.connectionManager.initPools();  // DB Connection 재연결
    if (sequelize.connectionManager.hasOwnProperty('getConnection')) {
      delete sequelize.connectionManager.getConnection;
    }
    const data = await sequelize.models.SomeModel({/** options **/ });  // 비즈니스 로직
  } catch (e) {
    throw e;
  }
  await sequelize.connectionManager.close();  // DB Connection 종료
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
  };
};
```

`sequelize.connectionManager.initPools` 함수로 다시 연결하고, `sequelize.connectionManager.close` 함수로 끊는다. 다시 연결할 때마다
getConnection 함수를 삭제해야 하는 이유가 궁금했다. 정확히 파악하려면 Sequelize 소스를 더 자세히 들여다봐야 알겠지만, close 함수의 용도가 모든 프로세스 종료 시에 사용하도록 만들어졌기
때문에 getConnection 함수의 유무에 따라 에러를 발생시키기 때문인 것 같다. 이제 sequelize 객체를 재사용하며, 핸들러 함수가 동작할 때마다 커넥션도 잘 끊는다. 이제 사용자가 폭증할 일만
기다리면 된다. 그렇게 에러 알림은 잠잠해 지는 듯 했다.

그러나 세 번째 문제가 발생한다.

---

## 세 번째 문제

### 간헐적으로 ECONNRESET 에러 발생

구글링을 해보니 ECONNRESET 에러가 발생하는 경우는 다음과 같다고 한다.

> 보통 서버가 어떠한 이유(전원 차단, 시스템 오류 등)로 이전의 연결 데이터를 잃어버렸고, 클라이언트는 여전히 socket을 연결하고 있을 때, 클라이언트가 서버에 연결을 시도했을 때 발생한다.

결과적으론, 정확한 원인(데이터베이스 설정 등)을 찾아 개선하는 방법은 시간이 오래 걸릴 것 같아 TODO로 남겨두고 우선 급한 불부터 끄기로 했다. 발생한 에러 로그를 뒤적여보니 한 가지 공통점이 있다.

### sequelize 객체를 사용 후 5분 초과 후 재사용 시 발생

좀 더 이해하기 쉽게 순서를 써보겠다.

1. 요청에 의해 Lambda가 실행된다.
2. sequelize 객체를 새로 생성하거나 이미 생성 된 것을 initPools 함수로 다시 연결한다.
3. 비즈니스 로직이 동작한다.
4. DB Connection을 끊고, 데이터를 반환하고 함수가 종료된다.
5. 시간이 5분이 초과되고 10분이 안된 상태에서, 다시 1번과 2번을 지나 **3번에서 ECONNRESET 에러가 발생**한다.

위 현상을 보고 유추한 것들은 다음과 같다.

- 2번은 아무짝에도 소용 없는 것인가?
- 데이터베이스에서 특정 기간이 지나면 연결을 끊는 것인가?

2번 부분을 제거하고 테스트 해 본 결과, 에러(`pool is draining and cannot accept work`)가 발생한다. 역시 꼭 필요한 과정이다. 다시 연결을 해야 sequelize 객체로
쿼리가 가능하다. 당연한 결과지만, 합리적 의심이라고 정신승리를 한다. 그러나 데이터베이스에서 연결을 끊는 지에 대한 의문은 아직 해결되지 않았다. PostgreSQL 설정을 바꿔가며 테스트를 하면, 현재
운영중인 서비스에 영향을 끼칠까 우려가 된다. 또 다시 정신승리를 한다.

일단 1차원적으로 생각해 수정한 방법은 아래와 같다.

```jsx
// 세 번째 문제의 해결 예제

const { Sequelize } = require('sequelize');
const GLOBAL = {
  sequelize: new Sequelize({/** options **/ });  // DB Connection open
  lastUpdatedTimestamp: Date.now(),
};

exports.handler = async (event, context) => {
  const limitSeconds = 300;  //  5분
  const now = Date.now();
  try {
    const isTimeOut = (now - GLOBAL.lastUpdatedTimestamp) > (limitSeconds * 1000);
    if (isTimeOut) {  // case: 마지막으로 요청한 시점으로부터 일정 시간을 초과할 경우
      delete GLOBAL.sequelize;
      GLOBAL.sequelize = new Sequelize({/** options **/ });  // DB Connection open
    }
    await GLOBAL.sequelize.connectionManager.initPools();  // DB Connection 재연결
    if (GLOBAL.sequelize.connectionManager.hasOwnProperty('getConnection')) {
      delete GLOBAL.sequelize.connectionManager.getConnection;
    }
    const data = await GLOBAL.sequelize.models.SomeModel({/** options **/ });  // 비즈니스 로직
  } catch (e) {
    throw e;
  }
  GLOBAL.lastUpdatedTimestamp = now;
  await GLOBAL.sequelize.connectionManager.close();  // DB Connection 종료
  return {
    statusCode: 200,
    body: JSON.stringify({
      data,
    }),
  };
};
```

마지막으로 호출된 지 5분을 초과한 시점부터 sequelize 객체를 지우고 새롭게 생성하여 사용한다. GLOBAL 이라는 임의의 전역 변수를 선언하여 sequelize 객체와 마지막 호출 시점을 할당하여
활용했다.

### DB Connection Pool 옵션

Lambda의 특수성에 맞게 Connection Pool 옵션을 잘 설정해야 한다. 두 번째 문제와도 연관이 있다. 하나의 Lambda 컨테이너가 최소의 커넥션 수를 사용할 수록 효율적이다. 각 옵션값에
대한 설명은 예제 코드의 주석으로 대체한다.

```jsx
const options = {
  dialect: 'postgres',
  pool: {
    max: 2,  // 최대 커넥션 값. Lambda는 한번에 하나의 요청을 처리하지만 Query에서 두개의 커넥션을 사용할 때가 있다. 예) Model.findAndCountAll()
    min: 0,  // 최소 커넥션 값. 0으로 설정하면 Lambda 실행 중 timeout이 발생할 때, Connection Pool 제거 로직이 모든 연결을 끊는다.
    idle: 0,  // 유휴 시간. 0으로 설정하면 연결이 Connection Pool 로 반환 된 후 즉시 정리된다. 한번의 요청에서 재사용할 일이 없으므로 0으로 설정.
    acquire: 3000,  // 연결 에러 Timeout 값. 밀리세컨드. Connection을 맺을 때, 설정된 값을 초과되면 Timeout 에러가 발생한다.
    evict: { Lambda 함수에 설정된 Timeout },  // 연결 제거 Timeout 값. 밀리세컨드. 설정된 값을 초과하면 연결을 끊는다.
  },
};

const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, dbConfig.options)
```

---

## 마치며

이상, AWS Lambda 환경에서 Sequelize를 사용하며 나타난 Connection 관련 문제들과 그 해결방법에 대해 알아보았다. 느끼고 배운게 많다. 테스트와 꼼꼼함은 과할 수록 좋은 것 같다.

아직 원인을 제거하지 못한 문제가 있다. 쿼리 한줄로 쉽게 해결될 수도 있으리란 희망을 안고 마무리 하겠다.

---

## 참고

- AWS Lambda의 구조: [https://jybaek.tistory.com/749](https://jybaek.tistory.com/749)
- Lambda 커넥션에 대한 AWS의
  답변: [https://github.com/sequelize/sequelize/issues/4938#issuecomment-245211042](https://github.com/sequelize/sequelize/issues/4938#issuecomment-245211042)
- Sequelize Connection Pool 옵션에 대한 어느 개발자의 의견(
  은인): [https://github.com/sequelize/sequelize/pull/12642#issuecomment-685789376](https://github.com/sequelize/sequelize/pull/12642#issuecomment-685789376)
- PostgreSQL 커넥션
  관리: [https://medium.com/@chrisjune_13837/postgres와-django의-connection-관리-5acf3f5c28a7](https://medium.com/@chrisjune_13837/postgres%EC%99%80-django%EC%9D%98-connection-%EA%B4%80%EB%A6%AC-5acf3f5c28a7)
- Sequelize Connection
  Manager: [https://sequelize.org/v5/file/lib/dialects/abstract/connection-manager.js.html](https://sequelize.org/v5/file/lib/dialects/abstract/connection-manager.js.html)

---
