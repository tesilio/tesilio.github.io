---
layout: posts
title: Ubuntu + Nginx + uWSGI 동시접속 에러 관련 이슈
description: Resource temporarily unavailable) while connecting to upstream 에러에 대해서!
tags: [ubuntu, nginx, socket, uwsgi, flask, python, error]
---

Ubuntu + Nginx + uWSGI 환경에 Resource temporarily unavailable) while connecting to upstream 에러에 대해서!

미래의 나를 위한 기록용!!

---

### 현상
동시접속(요청)이 많을경우 502 에러
1. Nginx: (11: Resource temporarily unavailable) while connecting to upstream 에러
2. uWSGI: your server socket listen backlog is limited to 100 connections 에러
3. Nginx: Too many open files 에러

### 현상에 대한 원인
1. Ubuntu 소켓 최대 커넥션 개수제한
    - 확인: ```sysctl -a | grep somaxconn```
    - 기본: ```net.core.somaxconn = 128```
2. uWSGI 소켓 허용 큐 사이즈
    - 옵션 listen 값([메뉴얼](https://uwsgi-docs.readthedocs.io/en/latest/Options.html#listen))
3. Nginx > events > worker_connections 제한
4. Ubuntu NOFILE Limit


### 원인에 대한 해결방법

1. Ubuntu socket max connection 변경
    - ```sudo /sbin/sysctl -w net.core.somaxconn=4096```


2. uWSGI 설정 변경
    - ```API.ini```에(uWSGI 설정파일) 아래 항목들 추가
        - ```listen=2000```
            - 만약 이 값이 Ubuntu 소켓 최대 커넥션 개수(net.core.somaxconn) 보다 크면 Listen queue size is greater than the system max net.core.somaxconn 라는 에러가 발생
        - ```ignore-sigpipe=true```
        - ```ignore-write-errors=true```
        - ```disable-write-exception```


3. Nginx 설정 변경
    - ```/etc/nginx/nginx.conf``` 수정
    ```
    events {
    	worker_connections 1024;
    }
    ```


4. Ubuntu open file&process 제한 영구변경
    - ```/etc/security/limits.conf``` 하단에 아래의 항목 추가
    ```
      # open files
      ubuntu hard nofile 512000
      ubuntu soft nofile 512000

      # process
      ubuntu hard nproc 512000
      ubuntu soft nproc 512000
    ```

### 마치며
각자 상황과 환경에는 해결방법이 다를 수 있으니, 참고용으로 봐주셨으면 한다.

### 참고
- http://leejaeng.tistory.com/25
- http://simp1e.tistory.com/39
- https://medium.com/hbsmith/too-many-open-files-%EC%97%90%EB%9F%AC-%EB%8C%80%EC%9D%91%EB%B2%95-9b388aea4d4e
- http://bong8nim.com/post/programming/etc/nginx-config-manual/
- http://whatisthenext.tistory.com/123

*잘못 된 정보에 대한 지적, 더 좋은 방법에 대한 의견 등은 언제나 많이많이 환영합니다.😆*
