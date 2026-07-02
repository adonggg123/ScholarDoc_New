// ScholarDoc Student Web — Announcement Service
// Mirrors announcement_service.dart

const AnnouncementService = {
    getClient() {
        return window.supabaseClient;
    },

    async getActiveAnnouncements() {
        const { data, error } = await this.getClient()
            .from('announcements')
            .select()
            .eq('isActive', true)
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    subscribeToAnnouncements(callback) {
        return this.getClient()
            .channel('announcements-stream')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'announcements',
            }, callback)
            .subscribe();
    }
};

window.AnnouncementService = AnnouncementService;
