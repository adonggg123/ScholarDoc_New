// ScholarDoc Student Web — Scholarship Service
// Mirrors scholarship_service.dart

const ScholarshipService = {
    getClient() {
        return window.supabaseClient;
    },

    async getScholarshipById(id) {
        if (!id) return null;
        const { data, error } = await this.getClient()
            .from('scholarships')
            .select()
            .eq('id', id);
        if (error || !data || data.length === 0) return null;
        return data[0];
    },

    async getActiveScholarships() {
        const { data, error } = await this.getClient()
            .from('scholarships')
            .select()
            .eq('isActive', true);
        if (error) throw error;
        return data || [];
    }
};

window.ScholarshipService = ScholarshipService;
