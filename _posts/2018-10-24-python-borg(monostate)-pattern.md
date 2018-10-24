---
layout: posts
title: python borg(monostate) design pattern
description: 파이썬 borg(monostate) 디자인 패턴에 대해서
tags: [python, pattern, borg, monostate]
---
## 특징
싱글톤(singleton)처럼 동작하나 단 하나의 인스턴스를 갖는 대신,
동일한 상태를 공유하는 인스턴스를 여러개 생성 할 수 있다.
즉, 인스턴스 ID를 공유하는 대신 상태를 공유하는 데 초점을 맞춘다.

인스턴스가 생성 될 때마다 기존에 생성 된 인스턴스들도 초기화된다.  
## 코드
```python
class Borg:
    _shared_state = {}

    def __init__(self):
        self.__dict__ = self._shared_state

    def __hash__(self):
        return 1

    def __eq__(self, other):
        try:
            return self.__dict__ is other.__dict__
        except:
            return 0
```

***

*잘못 된 정보에 대한 지적, 더 좋은 방법에 대한 의견 등은 언제나 많이많이 환영합니다.😆*
