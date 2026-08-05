/**
 * Mission1을 생성
 * 이미 존재하면 기존 미션을 반환
 * 
 * @param {Pool} db PostgreSQL 연결 객체
 * @param {string} google_id 사용자 구글 ID
 * @returns {Object} 생성된 mission1 또는 기존 missino1
 */
async function createMission1(db, google_id) {
    const searchQuery = `
        SELECT *
        FROM MISSION1
        WHERE google_id = $1
    `;
    
    const searchResult = await db.query(searchQuery, [ google_id ]);

    const mission1 = searchResult.rows[0];

    if (mission1) {
        return mission1;
    }
    
    const charListQuery = `
        SELECT char_name
        FROM USERS
        WHERE char_name IS NOT NULL
    `;

    const characterResult = await db.query(charListQuery);

    const characters = characterResult.rows.map(
        row => row.char_name
    );

    if (characters.length === 0) {
        throw new Error("배정 가능한 캐릭터가 없습니다. ");
    }

    const randomIndex = Math.floor(Math.random() * (characters.length));
    const targetChar = characters[ randomIndex ]

    const insertQuery = `
        INSERT INTO mission1 (google_id, target_char)
        VALUES ($1, $2)
        RETURNING *
    `;

    const insertResult = await db.query(insertQuery, [google_id, targetChar])

    const mission = insertResult.rows[0];

    return mission;
}

module.exports = {
    createMission1
};