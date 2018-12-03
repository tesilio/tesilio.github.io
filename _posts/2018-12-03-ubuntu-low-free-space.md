---
layout: posts
title: Ubuntu 16.04 용량이 부족할 때
description: 오래 된 리눅스 커널을 삭제해 용량을 확보하자.
tags: [ubuntu, linux, kernels]
---

우분투 용량이 부족할 때

---

### 리눅스 커널
AWS > ec2를 운영중인데, 며칠동안 야금야금 차오르는 용량이 궁금해서 계속 찾아보다 오늘 찾았다.
- `/usr/src` 해당 경로에 `linux-headers-4.4.0-*` 라는 것들이 있다(16.04 기준).

우분투의 커널 파일들이라고 한다. 오래 된 커널들은 정기적으로 삭제 해줘야 한단다.
커널에 대한 자세한 설명은 아래 참고부분에 잘 설명 된 곳의 링크를 걸어두었다.

### 커널삭제
```bash
sudo apt autoremove --purge
```

### 참고
- https://12bme.tistory.com/288
- http://ubuntuhandbook.org/index.php/2016/05/remove-old-kernels-ubuntu-16-04/
