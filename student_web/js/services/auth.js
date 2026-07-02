// ScholarDoc Student Web — Auth Service
// Mirrors auth_service.dart methods

const AuthService = {
    getClient() {
        return window.supabaseClient;
    },

    getCurrentUser() {
        return this.getClient().auth.getUser();
    },

    async getStudentProfile(uid) {
        const { data, error } = await this.getClient()
            .from('students')
            .select()
            .eq('uid', uid);
        if (error || !data || data.length === 0) return null;
        return data[0];
    },

    getStudentStream(uid) {
        return this.getClient()
            .channel(`student-profile-${uid}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'students',
                filter: `uid=eq.${uid}`
            });
    },

    async updateStudentProfile(uid, updates) {
        const { error } = await this.getClient()
            .from('students')
            .update(updates)
            .eq('uid', uid);
        if (error) throw error;

        // Log activity
        try {
            await this.getClient().from('audit_logs').insert({
                action: 'Updated profile information via Web Portal',
                userName: updates.fullName || 'Student',
                role: 'Student',
            });
        } catch (_) {}
    },

    async logout() {
        const { data: { user } } = await this.getClient().auth.getUser();
        if (user) {
            try {
                await this.getClient().from('presence').upsert({
                    uid: user.id,
                    isOnline: false,
                    lastSeen: new Date().toISOString(),
                });
            } catch (_) {}
        }
        await this.getClient().auth.signOut();
    }
};

window.AuthService = AuthService;
