---
layout: posts
title: python datetime 정리
description: 파이썬 datetime 변환, 연산 등을 해보자.
tags: [python, tip, datetime, timedelta]
---

파이썬 datetime 모듈중 자주 쓰는 것 위주로 정리했다.

***

## 1. datetime을 문자열로 바꾸기
```python
import datetime

now_datetime = datetime.datetime.now()
print(f"{type(now_datetime)}: {now_datetime}")
# <class 'datetime.datetime'>: 2018-09-13 22:29:37.255036

now_str_date = now_datetime.strftime('%Y-%m-%d')
print(f"{type(now_str_date)}: {now_str_date}")
# <class 'str'>: 2018-09-13

now_str_time = now_datetime.strftime('%H:%M:%S')
print(f"{type(now_str_time)}: {now_str_time}")
# <class 'str'>: 22:33:33

now_str_datetime = now_datetime.strftime('%Y-%m-%d %H:%M:%S')
print(f"{type(now_str_datetime)}: {now_str_datetime}")
# <class 'str'>: 2018-09-13 22:34:19
```

***

## 2. 문자열을 datetime으로 바꾸기
```python
import datetime

my_str_datetime = "2018-09-13 22:39:04"
my_datetime = datetime.datetime.strptime(my_str_datetime, '%Y-%m-%d %H:%M:%S')
print(f"{type(my_datetime)}: {my_datetime}")
# <class 'datetime.datetime'>: 2018-09-13 22:39:04
```

***

## 3. 날짜/시간 연산 (timedelta)
```python
import datetime

"""
주: datetime.timedelta(weeks=1)
일: datetime.timedelta(days=1)
시간: datetime.timedelta(hours=1)
분: datetime.timedelta(minutes=1)
초: datetime.timedelta(seconds=1)
밀리초: datetime.timedelta(milliseconds=1)
마이크로초: datetime.timedelta(microseconds=1)
"""
now_datetime = datetime.datetime.now()
print(f"{type(now_datetime)}: {now_datetime}")
# <class 'datetime.datetime'>: 2018-09-13 23:19:38.364179

tomorrow_datetime = now_datetime + datetime.timedelta(days=1)
print(f"{type(tomorrow_datetime)}: {tomorrow_datetime}")
# <class 'datetime.datetime'>: 2018-09-14 23:19:38.364179
```

***

## 4. 날짜/시간 차이를 구할 때
```python
import datetime

"""
datetime.datetime - datetime.datetime = datetime.timedelta

datetime.timedelta로 일수나 시간을 seconds로 변환
datetime.timedelta(days=1).total_seconds()
"""
day_seconds = datetime.timedelta(days=1).total_seconds()
print(f"{type(day_seconds)}: {day_seconds}")
# <class 'float'>: 86400.0

# <class 'datetime.datetime'>
first_datetime = datetime.datetime.strptime('2018-09-13 22:50:14', '%Y-%m-%d %H:%M:%S')
second_datetime = datetime.datetime.strptime('2018-09-16 22:40:34', '%Y-%m-%d %H:%M:%S')

result_timedelta = second_datetime - first_datetime
print(f"{type(result_timedelta)}: {result_timedelta}")  # 이틀하고도 85,820초가 지났다!!
# <class 'datetime.timedelta'>: 2 days, 23:50:20 

print(f"{type(result_timedelta.days)}: {result_timedelta.days}")
# <class 'int'>: 2

print(f"{type(result_timedelta.seconds)}: {result_timedelta.seconds}")
# <class 'int'>: 85820

# <class 'float'>
print(result_timedelta.total_seconds())
# 258620.0
```

***

## 5. 날짜/시간 변경(대치)
```python
import datetime

my_str_datetime = "2018-09-13 22:39:04"

my_datetime = datetime.datetime.strptime(my_str_datetime, '%Y-%m-%d %H:%M:%S')
print(f"{type(my_datetime)}: {my_datetime}")
# <class 'datetime.datetime'>: 2018-09-13 22:39:04

new_datetime = my_datetime.replace(year=2000, month=1, day=15, hour=3, minute=15, second=59)
print(f"{type(my_datetime)}: {my_datetime}")
# <class 'datetime.datetime'>: 2018-09-13 22:39:04
print(f"{type(new_datetime)}: {new_datetime}")
# <class 'datetime.datetime'>: 2000-01-15 03:15:59
```

***

## 6. 날짜/시간 사용 및 병합
```python
import datetime

my_date = datetime.date(2018, 9, 13)
print(f"{type(my_date)}: {my_date}")
# <class 'datetime.date'>: 2015-04-15

my_time = datetime.time(22, 39, 4)
print(f"{type(my_time)}: {my_time}")
# <class 'datetime.time'>: 22:39:04

my_datetime = datetime.datetime.combine(my_date, my_time)
print(f"{type(my_datetime)}: {my_datetime}")
# <class 'datetime.datetime'>: 2018-09-13 22:39:04
```

***

- [참고](https://godoftyping.wordpress.com/2015/04/19/python-%EB%82%A0%EC%A7%9C-%EC%8B%9C%EA%B0%84%EA%B4%80%EB%A0%A8-%EB%AA%A8%EB%93%88/)
- [포맷참고](https://docs.python.org/ko/3/library/datetime.html#strftime-and-strptime-behavior)

*잘못 된 정보에 대한 지적, 더 좋은 방법에 대한 의견 등은 언제나 많이많이 환영합니다.😆*
