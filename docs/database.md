```js
USERS {
    string google_id PK NOT NULL // 구글 아이디
    string name // 사용자 이름
    string char_name // 동숲 캐릭터 이름
    int completed_mission DEFAULT 0 
    /*
    미션 클리어 개수 
    0개: 0, 
    1개: 1, 
    2개: 2, 
    3개: 3, 
    */
    boolean developer_verified DEFAULT false // 관리자 비밀번호 입력 완료 시
}

MISSION1 {
    string google_id PK FK NOT NULL // 구글 아이디
    string target_char NOT NULL // 미션1 대상 캐릭터
    boolean completed DEFAULT FALSE // 미션1 성공 여부
    timestamp created_at // 만들어진 시간
}

MISSION2 {
    string google_id PK FK NOT NULL // 구글 아이디
    string target_char NOT NULL // 미션2 대상 캐릭터
    string mission NOT NULL // 미션 내용
    BYTEA image // 미션2 성공 이미지
    boolean completed DEFAULT FALSE // 미션2 성공 여부
    timestamp created_at // 만들어진 시간
}

MISSION3 {
    string google_id PK FK NOT NULL // 구글 아이디
    BYTEA image // 미션3 성공 이미지
    boolean completed DEFAULT FALSE // 미션3 성공 여부
    timestamp created_at // 만들어진 시간
}

```