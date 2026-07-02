// ScholarDoc Student Web — Notification Service
// Mirrors notification_service.dart

const NotificationService = {
    getClient() {
        return window.supabaseClient;
    },

    async getNotifications(studentId) {
        const { data, error } = await this.getClient()
            .from('notifications')
            .select()
            .eq('studentId', studentId)
            .order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async markAsRead(notificationId) {
        const { error } = await this.getClient()
            .from('notifications')
            .update({ isRead: true })
            .eq('id', notificationId);
        if (error) throw error;
    },

    async markAllAsRead(studentId) {
        const { error } = await this.getClient()
            .from('notifications')
            .update({ isRead: true })
            .eq('studentId', studentId)
            .eq('isRead', false);
        if (error) throw error;
    },

    subscribeToNotifications(studentId, callback) {
        return this.getClient()
            .channel(`notif-${studentId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `studentId=eq.${studentId}`
            }, callback)
            .subscribe();
    }
};

window.NotificationService = NotificationService;
