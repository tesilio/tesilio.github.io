---
layout: posts
title: NodeJs로 10분만에 Telegram Bot 만들기
description: AWS API Gateway + AWS Lambda + NodeJs 를 이용하여 서버리스 텔레그램 봇을 만들어보자.
tags: [aws, lambda, telegram, nodejs]
---

AWS API Gateway + AWS Lambda + NodeJs 를 이용하여 서버리스 텔레그램 봇을 만들어보자.

---

### 준비사항
- AWS 계정
- 텔레그램 클라이언트
- 기본적으로 AWS Lambda 와 AWS API Gateway를 활용할 수 있다고 가정하여 작성했다.

### 봇 등록
1. BotFather와 대화시작
    - http://t.me/BotFather
2. 새로운 봇 생성
    - /newbot
3. 봇 이름 입력
    - 나중에 변경 할 수 있다.
4. 봇계정명(username) 입력
    - 변경 할 수 없다.
    - 반드시 `Bot`이나 `bot`으로 끝나야 한다.
    - 예) `TestBot` 혹은 `test_bot`
5. token을 저장해둔다.
6. 1:1 대화 시작
    - t.me/<봇계정명>

### 웹훅
사용자의 메세지를 받아 처리하여 응답하는 봇을 만들고 싶다면 서버가 필요하다.  
요즘 대세는 서버리스니까 AWS API Gateway + Lambda 를 이용하여 엔드포인트(URL)를 하나 생성한다.
- 예) https://test.execute-api.ap-northeast-2.amazonaws.com/bot/
  ```
  # <token> 부분을 봇 등록 시 발급받은 토큰으로 대치한다.

  # 웹훅 URL 등록
  curl -F "url=https://test.execute-api.ap-northeast-2.amazonaws.com/bot/" https://api.telegram.org/bot<token>/setWebhook

  # 등록되어 있는 모든 웹훅 URL 삭제
  curl https://api.telegram.org/bot<token>/setWebhook
  ```

### AWS API Gateway
- 웹훅 요청은 POST method로 들어온다.
- API Gateway에서 응답을 구성해도 되고 Lambda 통합 프록시로 구성해도 된다.
- 아래의 Lambda 예제는 Lambda 통합 프록시 구성 예제이다.

### AWS Lambda(NodeJs8.10)
- 필요 모듈
    - node-telegram-bot-api

- 특정 메세지를 받으면 응답하는 예제이다.
- 응답 http status code가 `200`이 아니면 성공할때까지 요청이 들어온다. 그러니 에러핸들링을 잘 해야 한다.

```javascript
"use strict";


const TelegramBotApi = require("node-telegram-bot-api");
const bot = TelegramBotApi(<token>);

exports.handler = async (event, context) => {
    let response;
    response.statusCode = 200;
    const requestBody = JSON.parse(event.body);
    try {
        const message = requestBody.message;
        if (message.text === "반갑다") {
            const chatId = message.chat.id;
            await bot.sendMessage(chatId, "저도 반가워요");
        }
    } catch (e) {
        console.error(`Error: ${e}`);
        const chatId = requestBody.message.chat.id;
        await bot.sendMessage(chatId, "잘못 된 요청이거나 서버 에러입니다!");
    }
    return response;
}
```

---
