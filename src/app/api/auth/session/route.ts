import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    
    // In a real production app, we would verify the Firebase ID Token using firebase-admin here
    // and create a session cookie: admin.auth().createSessionCookie(token, { expiresIn })
    
    // For now, we simply set a mock session cookie indicating the user is logged in.
    // The middleware will read this to allow access to /dashboard.
    const response = NextResponse.json({ success: true });
    
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    // Also set a mock user_role for MVP testing (admin)
    response.cookies.set('user_role', 'admin', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
