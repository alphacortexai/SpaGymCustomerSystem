import { NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type'); // 'invoice' or 'pop'
    const clientId = formData.get('clientId');

    if (!file || !type || !clientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `memberships/${clientId}/${type}/${fileName}`);
    
    await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    const downloadURL = await getDownloadURL(storageRef);

    return NextResponse.json({
      success: true,
      url: downloadURL,
      name: file.name,
      type: file.type
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
