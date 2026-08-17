import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { uploadImageBuffer, getUploadDir } from '../src/services/storage.service.js';

async function runTest() {
    console.log('--- Sharp WebP Storage Verification Test ---');

    // 1. Create a 100x100 sample PNG buffer using Sharp
    const sampleBuffer = await sharp({
        create: {
            width: 100,
            height: 100,
            channels: 4,
            background: { r: 255, g: 100, b: 50, alpha: 1 }
        }
    })
        .png()
        .toBuffer();

    console.log(`1. Original sample PNG buffer size: ${sampleBuffer.length} bytes`);

    // 2. Upload image buffer via storage service
    const fileUrl = await uploadImageBuffer(sampleBuffer, 'shops');
    console.log(`2. Uploaded image file URL: ${fileUrl}`);

    // 3. Extract filename from URL
    const filename = path.basename(fileUrl);
    console.log(`3. Extracted filename: ${filename}`);

    // 4. Verify file is saved in top-level uploads dir (no subfolders)
    const uploadDir = getUploadDir();
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ ERROR: File does not exist at expected path: ${filePath}`);
        process.exit(1);
    }

    const savedStats = fs.statSync(filePath);
    console.log(`4. Saved file size on disk: ${savedStats.size} bytes`);

    // 5. Verify image format is WebP by checking header magic bytes ('RIFF' and 'WEBP')
    const fileHeader = fs.readFileSync(filePath).toString('ascii', 0, 12);
    console.log(`5. File Header: ${fileHeader}`);

    if (fileHeader.startsWith('RIFF') && fileHeader.includes('WEBP')) {
        console.log('✅ WebP Image Magic Header Verification PASSED');
    } else {
        console.error(`❌ ERROR: Expected RIFF...WEBP header, but got ${fileHeader}`);
        process.exit(1);
    }

    // 6. Clean up test file
    fs.unlinkSync(filePath);
    console.log('6. Cleaned up temporary test file.');

    console.log('\n🎉 ALL SHARP WEBP LOCAL/VPS STORAGE TESTS PASSED!');
}

runTest().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
