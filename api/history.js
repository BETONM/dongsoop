const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
    const google_id = req.user.google_id;

    try {
        const m1Query = `
            SELECT *
            FROM mission1
            WHERE google_id = $1
        `;

        const m2Query = `
            SELECT *
            FROM mission2
            WHERE google_id = $1
        `;

        const m3Query = `
            SELECT *
            FROM mission3
            WHERE google_id = $1
        `;

        const [m1Result, m2Result, m3Result] = await Promise.all([
            db.query(m1Query, [google_id]),
            db.query(m2Query, [google_id]),
            db.query(m3Query, [google_id])
        ]);

        const mission1 = m1Result.rows[0];
        const mission2 = m2Result.rows[0];
        const mission3 = m3Result.rows[0];

        return res.status(200).json({
            success: true, 
            message: "조회 성공", 
            history: {
                mission1: mission1
                    ? {
                    target_char: mission1.target_char, 
                    completed: mission1.completed
                    }
                    : null, 

                mission2: mission2
                    ? {
                    target_char: mission2.target_char, 
                    mission: mission2.mission,
                    completed: mission2.completed, 
                    image: mission2.image
                        ? mission2.image.toString("base64")
                        : null
                    } 
                    : null, 

                mission3: mission3
                    ? {
                    completed: mission3.completed, 
                    image: mission3.image
                        ? mission3.image.toString("base64")
                        : null
                    }
                    : null
            }
        });
    }
    catch (err) {
        console.error("미션 조회 오류: ", err);
        return res.status(500).json({
            success: false, 
            message: "서버 연결 오류"
        });
    }
});

module.exports = router;