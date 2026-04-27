import { zhipuai } from './_utils';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持JPG、PNG、WebP格式的图片'));
    }
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return new Promise((resolve) => {
    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.error('文件上传失败:', err);
        return resolve(res.status(400).json({ error: err.message }));
      }

      if (!req.file) {
        return resolve(res.status(400).json({ error: '请上传图片' }));
      }

      try {
        const imagePath = req.file.path;
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        const messages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请提取图片中的所有文字内容，保持原始格式'
              },
              {
                type: 'image',
                image: base64Image
              }
            ]
          }
        ];
        
        const response = await zhipuai.chat.completions.create({
          model: 'glm-4v',
          messages: messages,
          temperature: 0.1
        });

        const ocrResult = response.choices[0].message.content;

        try {
          fs.unlinkSync(imagePath);
        } catch (unlinkError) {
          console.error('清理临时文件失败:', unlinkError);
        }

        if (!ocrResult || ocrResult.length < 10) {
          return resolve(res.status(400).json({ error: '无法从图片中提取有效内容' }));
        }

        resolve(res.json({ content: ocrResult }));
      } catch (error) {
        console.error('图片提取失败:', error);
        
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {
            console.error('清理临时文件失败:', e);
          }
        }

        resolve(res.status(500).json({ error: '图片内容提取失败，请稍后重试' }));
      }
    });
  });
}