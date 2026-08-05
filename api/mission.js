const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { createMission2 } = require('../utils/missionGenerator');

router.get('/', async (req, res) => {
    const google_id = req.user.google_id;

    try {
        const searchQuery = `
            SELECT completed_mission
            FROM USERS
            WHERE google_id = $1
        `;

        const searchResult = await db.query(searchQuery, [ google_id ]);

        const user = searchResult.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false, 
                message: "사용자 없음"
            });
        }

        const completedMission = user.completed_mission;

        switch (completedMission) {
            case 0: 
                const m1Query = `
                    SELECT *
                    FROM mission1
                    WHERE google_id = $1
                `;
                const m1Result = await db.query(m1Query, [ google_id ]);
                const mission1 = m1Result.rows[0];

                if (!mission1) {
                    return res.status(404).json({
                        success: false, 
                        message: "Mission1이 없습니다"
                    });
                }

                return res.status(200).json({
                    success: true, 
                    message: "주민과 3분간 대화하기", 
                    mission: {
                        number: 1, 
                        target_char: mission1.target_char, 
                        completed: mission1.completed
                    }
                });
            case 1:
                const m2Query = `
                    SELECT *
                    FROM mission2
                    WHERE google_id = $1
                `;
                const m2Result = await db.query(m2Query, [ google_id ]);
                const mission2 = m2Result.rows[0];

                if (!mission2) {
                    return res.status(404).json({
                        success: false, 
                        message: "Mission2이 없습니다"
                    });
                }

                return res.status(200).json({
                    success: true, 
                    message: "주민과 사진 미션 수행하기", 
                    mission: {
                        number: 2, 
                        target_char: mission2.target_char, 
                        mission: mission2.mission, 
                        completed: mission2.completed
                    }
                });
            case 2:
                const m3Query = `
                    SELECT *
                    FROM mission3
                    WHERE google_id = $1
                `;
                const m3Result = await db.query(m3Query, [ google_id ]);
                const mission3 = m3Result.rows[0];

                if (!mission3) {
                    return res.status(404).json({
                        success: false, 
                        message: "주민과 뱃지 인증사진 찍기"
                    });
                }

                return res.status(200).json({
                    success: true, 
                    message: "주민과 프메 스티커 인증사진 찍기", 
                    mission: {
                        number: 3, 
                        completed: mission3.completed
                    }
                });
            case 3: 
                return res.status(200).json({
                    success: true, 
                    message: "모든 미션을 완료했습니다. "
                });
            default: 
                return res.status(400).json({
                    success: false,
                    message: "잘못된 미션 상태입니다. "
                });
        }
    }
    catch (err) {
        console.error("미션 탐색 오류: ", err);
        res.status(500).json({
            success: false, 
            message: "서버 오류 발생"
        });
    }
});

router.patch('/1', async (req, res) => {
    const google_id = req.user.google_id;

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const updateQuery = `
            UPDATE mission1
            SET completed = TRUE
            WHERE google_id = $1
            RETURNING *
        `;

        const updateResult = await client.query(updateQuery, [ google_id ]);

        const mission1 = updateResult.rows[0];

        if (!mission1) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false, 
                message: "유효하지 않은 mission1 입니다. "
            });
        }

        const updateUserQuery = `
            UPDATE USERS
            SET completed_mission = 1
            WHERE google_id = $1
            RETURNING *
        `;

        const updateUserResult = await client.query(updateUserQuery, [ google_id ]);

        const user = updateUserResult.rows[0];

        if (!user) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false, 
                message: "유효하지 않은 user 입니다. "
            });
        }

        await createMission2(client, google_id);        

        await client.query("COMMIT");
        
        return res.status(200).json({
            success: true, 
            message: "mission1 clear"
        });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("mission1 완료 오류:", err);
        res.status(500).json({
            success: false, 
            message: "서버 오류 발생"
        });
    }
    finally {
        client.release();
    }
});

router.patch('/2', async (req, res) => {
    const google_id = req.user.google_id;
    const { image } = req.body;

    if (typeof image !== "string" || image.trim() === "") {
        return res.status(400).json({
            success: false,
            message: "사진을 업로드해주세요."
        });
    }

    const client = await db.connect();

    try {
        const imageBuffer = Buffer.from(image, "base64");

        if (imageBuffer.length === 0) {
            return res.status(400).json({
                success: false,
                message: "올바르지 않은 이미지입니다."
            });
        }
        
        await client.query("BEGIN");

        const updateQuery = `
            UPDATE mission2
            SET 
                image = $1,
                completed = TRUE
            WHERE google_id = $2 AND completed = false
            RETURNING *
        `;

        const updateResult = await client.query(updateQuery, [ imageBuffer, google_id ]);

        const mission2 = updateResult.rows[0];

        if (!mission2) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false, 
                message: "유효하지 않은 mission2 입니다. "
            });
        }

        const updateUserQuery = `
            UPDATE USERS
            SET completed_mission = 2
            WHERE google_id = $1
            RETURNING *
        `;

        const updateUserResult = await client.query(updateUserQuery, [ google_id ]);

        const user = updateUserResult.rows[0];

        if (!user) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false, 
                message: "유효하지 않은 user 입니다. "
            });
        }

        await createMission3(client, google_id);        

        await client.query("COMMIT");
        
        return res.status(200).json({
            success: true, 
            message: "mission2 clear"
        });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("mission2 완료 오류:", err);
        res.status(500).json({
            success: false, 
            message: "서버 오류 발생"
        });
    }
    finally {
        client.release();
    }
});

module.exports = router;