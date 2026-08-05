const express = require('express');
const router = express.Router();
const db = require('../config/db');
require('dotenv').config();

const CHARACTERS = require('../constants/characters');
const { createMission1 } = require('../utils/missionGenerator');

router.get('/', (req, res) => {
    res.json({ success: true, message: "user api 성공" });
});

router.get('/me', async (req, res) => { 
    const google_id = req.user.google_id;

    try {
        const result = await db.query(`
            SELECT * 
            FROM USERS 
            WHERE google_id = $1
            `, 
        [google_id] );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false, 
                message: "사용자 없음"
            });
        }

        res.status(200).json({
            success: true, 
            message: "사용자 정보 조회 완료", 
            user: {
                google_id: user.google_id, 
                name: user.name, 
                char_name: user.char_name, 
                completed_mission: user.completed_mission, 
                developer_verified: user.developer_verified
            }
        });
    }
    catch (err) {
        console.error("사용자 정보 조회 오류:", err);
        res.status(500).json({
            success: false, 
            message: "서버 오류 발생"
        });
    }
});

router.patch('/profile', async (req, res) => {
    const google_id = req.user.google_id;
    const { name, char_name } = req.body;
    
    try {
        if (typeof name !== "string" || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "이름을 입력해주세요."
            });
        }
        if (typeof char_name !== "string" || char_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "캐릭터를 선택해주세요."
            });
        }
        
        const cleanName = name.trim();
        const cleanCharName = char_name.trim();

        if (!CHARACTERS.includes(cleanCharName)) {
            return res.status(400).json({
                success: false,
                message: "올바르지 않은 캐릭터입니다."
            });
        }

        const updateQuery = `
            UPDATE USERS
            SET
                name = $1, 
                char_name = $2
            WHERE
                google_id = $3
            RETURNING *
        `;
        const updateResult = await db.query(updateQuery, [cleanName, cleanCharName, google_id]);

        const user = updateResult.rows[0];
        if (!user) {
            return res.status(404).json({
                success: false, 
                message: "사용자 없음"
            });
        }

        await createMission1(db, google_id);

        res.status(200).json({
            success: true, 
            message: "사용자 정보 수정 완료", 
            user: {
                google_id: user.google_id, 
                name: user.name, 
                char_name: user.char_name, 
                completed_mission: user.completed_mission, 
                developer_verified: user.developer_verified
            }
        });
    }
    catch (err) {
        console.error("사용자 정보 수정 오류: ", err);
        res.status(500).json({
            success: false, 
            message: "서버 오류 발생"
        });
    }
});

router.patch('/verify', async (req, res) => {
    const google_id = req.user.google_id;
    const { password } = req.body;

    try {
        if (typeof password !== "string" || password.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "관리자 비밀번호를 입력해주세요."
            });
        }

        const searchQuery = `
            SELECT completed_mission, developer_verified
            FROM USERS
            WHERE google_id = $1
        `;

        const searchResult = await db.query(searchQuery, [google_id]);

        const user = searchResult.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "사용자 없음"
            });
        }

        if (user.completed_mission !== 3) {
            return res.status(400).json({
                success: false,
                message: "아직 모든 미션을 완료하지 않았습니다."
            });
        }

        if (user.developer_verified) {
            return res.status(400).json({
                success: false,
                message: "이미 인증이 완료되었습니다."
            });
        }

        if (password.trim() !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({
                success: false,
                message: "관리자 비밀번호가 올바르지 않습니다."
            });
        }

        const updateQuery = `
            UPDATE USERS
            SET developer_verified = TRUE
            WHERE google_id = $1
            RETURNING *
        `;

        const updateResult = await db.query(updateQuery, [google_id]);

        const verifiedUser = updateResult.rows[0];

        return res.status(200).json({
            success: true,
            message: "최종 인증이 완료되었습니다.",
            user: {
                google_id: verifiedUser.google_id,
                name: verifiedUser.name,
                char_name: verifiedUser.char_name,
                completed_mission: verifiedUser.completed_mission,
                developer_verified: verifiedUser.developer_verified
            }
        });
    }
    catch (err) {
        console.error("관리자 인증 오류:", err);
        return res.status(500).json({
            success: false,
            message: "서버 오류 발생"
        });
    }
});

module.exports = router;