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

## ngram은 무엇이며, 무슨 원리인가

- https://dev.mysql.com/doc/refman/5.7/en/fulltext-search-ngram.html
