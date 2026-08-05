const MISSIONS = require('../constants/missions');

function getRandomItem(array) {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}

/**
 * Mission1을 생성
 * 이미 존재하면 기존 미션을 반환
 * 
 * @param {PoolClient} client PostgreSQL 연결 객체
 * @param {string} google_id 사용자 구글 ID
 * @returns {Object} 생성된 mission1 또는 기존 missino1
 */
async function createMission1(client, google_id) {
    const searchQuery = `
        SELECT *
        FROM MISSION1
        WHERE google_id = $1
    `;
    
    const searchResult = await client.query(searchQuery, [ google_id ]);

    const existingMission= searchResult.rows[0];

    if (existingMission) {
        return existingMission;
    }
    
    const charListQuery = `
        SELECT char_name
        FROM USERS
        WHERE char_name IS NOT NULL
    `;

    const characterResult = await client.query(charListQuery);

    const characters = characterResult.rows.map(
        row => row.char_name
    );

    if (characters.length === 0) {
        throw new Error("배정 가능한 캐릭터가 없습니다. ");
    }

    const targetChar = getRandomItem(characters)

    const insertQuery = `
        INSERT INTO mission1 (google_id, target_char)
        VALUES ($1, $2)
        RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [google_id, targetChar])

    const newMission = insertResult.rows[0];

    return newMission;
}

/**
 * Mission2을 생성
 * 이미 존재하면 기존 미션을 반환
 * 
 * @param {PoolClient} client PostgreSQL 연결 객체
 * @param {string} google_id 사용자 구글 ID
 * @returns {Object} 생성된 mission2 또는 기존 mission2
 */
async function createMission2(client, google_id) {
    const searchQuery = `
        SELECT *
        FROM MISSION2
        WHERE google_id = $1
    `;
    
    const searchResult = await client.query(searchQuery, [ google_id ]);

    const existingMission = searchResult.rows[0];

    // 만약 mission2가 있으면 -> mission2 생성 안하고, 기존꺼 반환
    if (existingMission) {
        return existingMission;
    }
    
    const charListQuery = `
        SELECT char_name
        FROM USERS
        WHERE char_name IS NOT NULL
    `;

    const characterResult = await client.query(charListQuery);

    const characters = characterResult.rows.map(
        row => row.char_name
    );

    if (characters.length === 0) {
        throw new Error("배정 가능한 캐릭터가 없습니다. ");
    }

    const targetChar = getRandomItem(characters);
    if (MISSIONS.length === 0) {
        throw new Error("배정 가능한 미션이 없습니다. ");
    }
    const mission = getRandomItem(MISSIONS);

    const insertQuery = `
        INSERT INTO mission2 (google_id, target_char, mission)
        VALUES ($1, $2, $3)
        RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [google_id, targetChar, mission])

    const newMission = insertResult.rows[0];

    return newMission;
}

/**
 * Mission3을 생성
 * 이미 존재하면 기존 미션을 반환
 * 
 * @param {PoolClient} client PostgreSQL 연결 객체
 * @param {string} google_id 사용자 구글 ID
 * @returns {Object} 생성된 mission3 또는 기존 mission3
 */
async function createMission3(client, google_id) {
    const searchQuery = `
        SELECT *
        FROM MISSION3
        WHERE google_id = $1
    `;
    
    const searchResult = await client.query(searchQuery, [ google_id ]);

    const existingMission = searchResult.rows[0];

    // 만약 mission3가 있으면 -> mission3 생성 안하고, 기존꺼 반환
    if (existingMission) {
        return existingMission;
    }

    const insertQuery = `
        INSERT INTO mission3 (google_id)
        VALUES ($1)
        RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [ google_id ])

    const newMission = insertResult.rows[0];

    return newMission;
}

module.exports = {
    createMission1, 
    createMission2, 
    createMission3
};