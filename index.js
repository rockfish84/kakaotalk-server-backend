require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// 서비스 계정 JSON 로드
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

// 1) 올바른 프로젝트 ID가 로드됐는지 확인
console.log('🔍 loaded serviceAccount.project_id =', serviceAccount.project_id);

// 2) 하드코딩 덮어쓰기(환경변수가 틀릴 때 안전장치)
const PROJECT_ID = 'kakaotall-33df9';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
});

// 다시 한 번 확인
console.log('🔍 admin.app().options.projectId =', admin.app().options.projectId);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 메모리 저장소 (실제론 DB 사용 권장)
const deviceTokens = new Set();

// 토큰 등록
app.post('/register-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });
    deviceTokens.add(token);
    console.log('✅ Registered token:', token);
    res.json({ success: true });
});

// 토큰 목록 조회
app.get('/tokens', (req, res) => {
    res.json({ tokens: Array.from(deviceTokens) });
});

// 푸시 발송
app.post('/send', async (req, res) => {
    const { type, content, emoticonRes } = req.body;
    if (deviceTokens.size === 0) {
        return res.status(400).json({ error: 'No device tokens registered' });
    }

    const message = {
        tokens: Array.from(deviceTokens),
        data: { type, content, emoticonRes: emoticonRes || '' },
        android: { priority: 'high' }
    };

    try {
        const response = await admin.messaging().sendMulticast(message);
        console.log('✅ FCM response:', response);
        res.json({ success: true, response });
    } catch (err) {
        // 3) error.code 와 error.details 까지 모두 찍고 응답
        console.error('❌ Error sending FCM:', {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 FCM server listening on port ${PORT}`);
});
