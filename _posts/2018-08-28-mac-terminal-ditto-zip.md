---
layout: posts
title: Mac 터미널에서 ditto를 이용한 폴더 및 파일 압축(zip)
tags: [mac, terminal, cli, zip, archive, compress, ditto]
---

AWS 람다 함수를 자동 배포하는 스크립트를 작성하던 중이었다.
배포 패키지는 zip파일로 업로드를 해야한다.
압축하기 전 용량이 대략 26MB 정도다.

기능 개발중에는 파인더에서 직접 우클릭 > 압축을 사용했다.
> 이러면 생성 된 zip 파일의 용량은 9.3MB 정도다.

**zip** 명령어로 터미널에서 압축을 시도해 보았다.
```bash
zip -r result.zip {대상 경로}
```
> 이러면 23MB다. 너무 크다.

그래서 다른 archive 프로그램인 **tar**로 압축기능(gzip)을 추가하여 써봤다.
```bash
tar -zcvf result.zip {대상 경로}
```
> 생성 된 result.zip의 용량은 9MB 정도였다.

기쁜 마음으로 업로드를 했으나, zip 파일이 아니라는 오류가 발생해서 실패했다.

그러면 파인더에서 사용하는 프로그램(아카이브 유틸리티.app)이 사용(?)하는게 뭔지 구글링 해봤더니
**Ditto**라는 녀석을 사용한다고 한다.

- - -
## Ditto
폴더, 파일 병합등의 기능이 있는 BSD Unix 시스템 기본 명령어라고 한다. [참고](https://ssumer.com/mac-%ED%84%B0%EB%AF%B8%EB%84%90%EC%97%90%EC%84%9C-ditto-%EB%AA%85%EB%A0%B9%EC%9D%84-%EC%9D%B4%EC%9A%A9%ED%95%9C-%ED%8F%B4%EB%8D%94-%EB%B3%91%ED%95%A9/)

어쨌든, 압축을 해 보았다. [매뉴얼 참고](https://ss64.com/osx/ditto.html)
```bash
ditto -c -k --sequesterRsrc --keepParent {대상 경로} result.zip
```
> 생성 된 result.zip 의 용량이 9.3MB 였다.

업로드를 해보니 작동이 아주 잘 된다.

# 요약
터미널에서 zip파일을 파인더(아카이브 유틸리티.app)를 이용 한 것처럼 생성하려면, **ditto**명령어를 이용하자.

- - -
*잘못 된 정보에 대한 지적, 더 좋은 방법에 대한 의견 등은 언제나 많이많이 환영합니다.😆*
