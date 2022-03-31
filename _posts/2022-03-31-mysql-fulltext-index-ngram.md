---
layout: posts
title: MySQL 5.7 FullText 인덱스(with ngram)
description: like 검색결과가 영 마음에 들지 않아, 더 좋은 방법이 있나 찾아보니 역시 이런 좋은 것이 있었다.
tags: [mysql, fulltext, index, RDBMS]
---

`like` 검색결과가 영 마음에 들지 않아, 더 좋은 방법이 있나 찾아보니 역시 이런 좋은 것이 있었다. 정보 전달보단 기록의 목적으로 남겨둔다.

---

## 인덱스 생성

```sql
ALTER TABLE test
    ADD FULLTEXT INDEX title_f_t_index (title) WITH PARSER ngram;
```

## 검색 쿼리

```sql
SELECT t.title
FROM test t
WHERE MATCH(title) AGAINST('과자')
order by title
LIMIT 100;
```

## 특정 단어 검색이 안 될 경우

검색하는 단어가 `stopword`라서 발생하는 문제이다. 아래와 같이 환경변수 값을 변경해야 한다.
```sql
SET GLOBAL innodb_ft_enable_stopword = 0;
```
RDS라면 파라미터 그룹에서 `innodb_ft_enable_stopword` 값을 0으로 바꿔주면 된다.

그리고 인덱스 키를 drop 후 다시 생성해야 적용된다.
```sql
# 1
drop index title_f_t_index on test;

# 2
ALTER TABLE test
    ADD FULLTEXT INDEX title_f_t_index (title) WITH PARSER ngram;
```

## 참고

- https://dev.mysql.com/doc/refman/5.7/en/fulltext-search-ngram.html
- https://cotak.tistory.com/158
