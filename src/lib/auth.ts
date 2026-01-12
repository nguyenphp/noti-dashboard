import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// Hardcoded user for simplicity
const ADMIN_USER = {
    id: '1',
    name: 'Admin',
    email: 'admin@noti.app',
    password: 'admin123',
};

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET || 'noti-dashboard-super-secret-key-2024',
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                console.log('[Auth] Login attempt:', credentials?.email);

                if (!credentials?.email || !credentials?.password) {
                    console.log('[Auth] Missing credentials');
                    return null;
                }

                // Check email and password
                if (credentials.email === ADMIN_USER.email &&
                    credentials.password === ADMIN_USER.password) {
                    console.log('[Auth] Login successful');
                    return {
                        id: ADMIN_USER.id,
                        name: ADMIN_USER.name,
                        email: ADMIN_USER.email,
                    };
                }

                console.log('[Auth] Invalid credentials');
                return null;
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id?: string }).id = token.id as string;
            }
            return session;
        },
    },
    debug: true, // Enable debug mode
};

