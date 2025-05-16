require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// 1) 서비스 계정 JSON 로드
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

// 2) 로드된 project_id 확인 (로그)
console.log('🔍 loaded serviceAccount.project_id =', serviceAccount.project_id);

// 3) (안전장치) 프로젝트 ID 하드코딩
const PROJECT_ID = 'kakaotall-33df9';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
});

// 4) 다시 한 번 Admin SDK에 설정된 projectId 확인
console.log('🔍 admin.app().options.projectId =', admin.app().options.projectId);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 5) 메모리 저장소 (실제론 Redis/MySQL 같은 영속화 저장소 권장)
const deviceTokens = new Set();

// 6) 토큰 등록
app.post('/register-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });
    deviceTokens.add(token);
    console.log('✅ Registered token:', token);
    res.json({ success: true });
});

// 7) 등록된 토큰 목록 조회
app.get('/tokens', (req, res) => {
    res.json({ tokens: Array.from(deviceTokens) });
});

// 8) 푸시 발송 (sendAll 우회 버전)
app.post('/send', async (req, res) => {
    const { type, content, emoticonRes } = req.body;
    const tokens = Array.from(deviceTokens);
    if (tokens.length === 0) {
        return res.status(400).json({ error: 'No device tokens registered' });
    }

    // 개별 메시지 배열 생성
    const messages = tokens.map(token => ({
        token,
        data: { type, content, emoticonRes: emoticonRes || '' },
        android: { priority: 'high' }
    }));

    try {
        const response = await admin.messaging().sendAll(messages);
        console.log('✅ sendAll response:', response);
        res.json({ success: true, response });
    } catch (err) {
        console.error('❌ sendAll error:', {
            message: err.message,
            code: err.code,
            details: err.details
        });
        res.status(500).json({
            error: err.message,
            code: err.code,
            details: err.details
        });
    }
});

// 9) 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 FCM server listening on port ${PORT}`);
});
