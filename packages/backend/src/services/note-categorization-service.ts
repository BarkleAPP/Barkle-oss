/**
 * Note Categorization Service
 * Automatically categorizes notes based on content analysis
 */

import { Note } from '@/models/entities/note.js';
import Logger from '@/services/logger.js';

const logger = new Logger('note-categorization');

export class NoteCategorization {
    /**
     * Categorize a note based on its content
     */
    public static categorizeNote(note: Note): string | null {
        try {
            // Combine text and hashtags for analysis
            const content = [
                note.text || '',
                ...(note.tags || [])
            ].join(' ').toLowerCase();

            if (!content.trim()) {
                return null;
            }

            // Technology keywords
            if (this.matchesKeywords(content, [
                'tech', 'ai', 'ml', 'crypto', 'bitcoin', 'blockchain', 'coding', 'programming',
                'javascript', 'python', 'react', 'vue', 'nodejs', 'web3', 'nft', 'metaverse',
                'vr', 'ar', 'software', 'developer', 'code', 'algorithm', 'data', 'api',
                'frontend', 'backend', 'database', 'cloud', 'aws', 'docker', 'kubernetes'
            ])) {
                return 'technology';
            }

            // Gaming keywords
            if (this.matchesKeywords(content, [
                'gaming', 'game', 'esports', 'twitch', 'steam', 'xbox', 'playstation',
                'nintendo', 'fps', 'mmo', 'rpg', 'gamer', 'gameplay', 'streamer',
                'valorant', 'fortnite', 'minecraft', 'league', 'dota', 'csgo'
            ])) {
                return 'gaming';
            }

            // Music keywords
            if (this.matchesKeywords(content, [
                'music', 'song', 'album', 'concert', 'band', 'artist', 'spotify',
                'soundcloud', 'vinyl', 'guitar', 'piano', 'singer', 'musician',
                'lyrics', 'melody', 'beat', 'remix', 'playlist', 'festival'
            ])) {
                return 'music';
            }

            // Sports keywords
            if (this.matchesKeywords(content, [
                'sports', 'football', 'soccer', 'basketball', 'baseball', 'tennis',
                'golf', 'olympics', 'fifa', 'nfl', 'nba', 'mlb', 'athlete', 'team',
                'match', 'game', 'championship', 'tournament', 'league', 'player'
            ])) {
                return 'sports';
            }

            // Entertainment keywords
            if (this.matchesKeywords(content, [
                'movie', 'film', 'tv', 'show', 'netflix', 'disney', 'marvel',
                'actor', 'actress', 'cinema', 'hollywood', 'series', 'episode',
                'trailer', 'premiere', 'director', 'streaming', 'entertainment'
            ])) {
                return 'entertainment';
            }

            // News/Politics keywords
            if (this.matchesKeywords(content, [
                'news', 'politics', 'election', 'government', 'policy', 'breaking',
                'update', 'announcement', 'president', 'minister', 'congress',
                'senate', 'vote', 'campaign', 'debate', 'law', 'legislation'
            ])) {
                return 'news';
            }

            // Art keywords
            if (this.matchesKeywords(content, [
                'art', 'design', 'drawing', 'painting', 'photography', 'creative',
                'artist', 'gallery', 'exhibition', 'sketch', 'illustration',
                'digital art', 'artwork', 'canvas', 'sculpture', 'aesthetic'
            ])) {
                return 'art';
            }

            // Food keywords
            if (this.matchesKeywords(content, [
                'food', 'recipe', 'cooking', 'restaurant', 'chef', 'cuisine',
                'dinner', 'lunch', 'breakfast', 'coffee', 'wine', 'meal',
                'delicious', 'tasty', 'kitchen', 'baking', 'foodie', 'eat'
            ])) {
                return 'food';
            }

            // Travel keywords
            if (this.matchesKeywords(content, [
                'travel', 'vacation', 'trip', 'tourism', 'hotel', 'flight',
                'adventure', 'explore', 'journey', 'destination', 'backpack',
                'wanderlust', 'passport', 'airport', 'beach', 'mountain'
            ])) {
                return 'travel';
            }

            // Health keywords
            if (this.matchesKeywords(content, [
                'health', 'fitness', 'workout', 'gym', 'wellness', 'medical',
                'doctor', 'medicine', 'mental', 'exercise', 'diet', 'nutrition',
                'therapy', 'hospital', 'healthy', 'meditation', 'yoga'
            ])) {
                return 'health';
            }

            // Business keywords
            if (this.matchesKeywords(content, [
                'business', 'startup', 'entrepreneur', 'finance', 'investment',
                'stock', 'market', 'economy', 'money', 'company', 'corporate',
                'sales', 'marketing', 'profit', 'revenue', 'ceo', 'management'
            ])) {
                return 'business';
            }

            // Education keywords
            if (this.matchesKeywords(content, [
                'education', 'learning', 'school', 'university', 'student',
                'teacher', 'course', 'study', 'knowledge', 'lesson', 'class',
                'homework', 'exam', 'degree', 'college', 'academic', 'research'
            ])) {
                return 'education';
            }

            // Fashion keywords
            if (this.matchesKeywords(content, [
                'fashion', 'style', 'clothing', 'outfit', 'designer', 'brand',
                'trend', 'beauty', 'makeup', 'dress', 'shoes', 'accessories',
                'model', 'runway', 'boutique', 'wardrobe', 'chic', 'elegant'
            ])) {
                return 'fashion';
            }

            // Science keywords
            if (this.matchesKeywords(content, [
                'science', 'research', 'study', 'discovery', 'experiment',
                'physics', 'chemistry', 'biology', 'space', 'nasa', 'lab',
                'scientist', 'theory', 'hypothesis', 'data', 'analysis'
            ])) {
                return 'science';
            }

            // Anime/Manga keywords
            if (this.matchesKeywords(content, [
                'anime', 'manga', 'otaku', 'cosplay', 'japan', 'japanese',
                'naruto', 'onepiece', 'dragonball', 'attack on titan', 'demon slayer',
                'studio ghibli', 'crunchyroll', 'funimation', 'weeb', 'kawaii'
            ])) {
                return 'anime';
            }

            // Books/Literature keywords
            if (this.matchesKeywords(content, [
                'book', 'books', 'reading', 'novel', 'author', 'writer',
                'literature', 'story', 'chapter', 'library', 'bookstore',
                'bestseller', 'fiction', 'nonfiction', 'poetry', 'biography'
            ])) {
                return 'books';
            }

            // Photography keywords
            if (this.matchesKeywords(content, [
                'photography', 'photo', 'camera', 'lens', 'photographer',
                'portrait', 'landscape', 'macro', 'street photography',
                'canon', 'nikon', 'sony', 'instagram', 'photoshoot'
            ])) {
                return 'photography';
            }

            // Default to null if no category matches
            return null;

        } catch (error) {
            logger.error('Error categorizing note:', error as Error);
            return null;
        }
    }

    /**
     * Check if content matches any of the given keywords
     */
    private static matchesKeywords(content: string, keywords: string[]): boolean {
        return keywords.some(keyword => {
            // Use word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(content);
        });
    }

    /**
     * Get all available categories
     */
    public static getAvailableCategories(): string[] {
        return [
            'technology',
            'gaming',
            'music',
            'sports',
            'entertainment',
            'news',
            'art',
            'food',
            'travel',
            'health',
            'business',
            'education',
            'fashion',
            'science',
            'anime',
            'books',
            'photography'
        ];
    }

    /**
     * Validate if a category is valid
     */
    public static isValidCategory(category: string): boolean {
        return this.getAvailableCategories().includes(category);
    }
}