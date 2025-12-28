/**
 * Content Categorization Service
 * Automatically categorizes notes based on content analysis
 */

import { Note } from '@/models/entities/note.js';
import { Notes } from '@/models/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('content-categorization');

export interface CategoryMatch {
    category: string;
    confidence: number;
    reasons: string[];
}

export class ContentCategorizationService {
    private static instance: ContentCategorizationService;

    // Category keywords with weights
    private readonly categoryKeywords = {
        technology: {
            keywords: ['tech', 'ai', 'ml', 'artificial intelligence', 'machine learning', 'crypto', 'bitcoin', 'blockchain', 'coding', 'programming', 'javascript', 'python', 'react', 'vue', 'nodejs', 'web3', 'nft', 'metaverse', 'vr', 'ar', 'virtual reality', 'augmented reality', 'software', 'hardware', 'computer', 'laptop', 'smartphone', 'app', 'website', 'database', 'cloud', 'aws', 'google cloud', 'azure', 'docker', 'kubernetes', 'api', 'framework', 'library', 'github', 'open source', 'cybersecurity', 'data science', 'analytics', 'algorithm', 'startup', 'saas'],
            weight: 1.0
        },
        gaming: {
            keywords: ['gaming', 'game', 'gamer', 'esports', 'twitch', 'steam', 'xbox', 'playstation', 'nintendo', 'fps', 'mmo', 'rpg', 'moba', 'battle royale', 'minecraft', 'fortnite', 'valorant', 'league of legends', 'dota', 'csgo', 'overwatch', 'wow', 'pokemon', 'zelda', 'mario', 'sonic', 'indie game', 'aaa game', 'console', 'pc gaming', 'mobile gaming', 'speedrun', 'streamer', 'gameplay'],
            weight: 1.0
        },
        music: {
            keywords: ['music', 'song', 'album', 'artist', 'band', 'concert', 'festival', 'spotify', 'apple music', 'soundcloud', 'vinyl', 'guitar', 'piano', 'drums', 'bass', 'singing', 'vocals', 'lyrics', 'melody', 'rhythm', 'beat', 'genre', 'rock', 'pop', 'hip hop', 'rap', 'jazz', 'classical', 'electronic', 'edm', 'country', 'folk', 'blues', 'reggae', 'punk', 'metal', 'indie', 'acoustic', 'live music', 'recording', 'producer', 'dj', 'remix'],
            weight: 1.0
        },
        sports: {
            keywords: ['sports', 'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf', 'olympics', 'fifa', 'nfl', 'nba', 'mlb', 'nhl', 'premier league', 'champions league', 'world cup', 'super bowl', 'playoffs', 'championship', 'athlete', 'team', 'coach', 'training', 'workout', 'fitness', 'gym', 'running', 'marathon', 'cycling', 'swimming', 'boxing', 'mma', 'ufc', 'wrestling', 'volleyball', 'cricket', 'rugby', 'hockey'],
            weight: 1.0
        },
        entertainment: {
            keywords: ['movie', 'film', 'cinema', 'tv', 'show', 'series', 'netflix', 'disney', 'marvel', 'dc', 'star wars', 'actor', 'actress', 'director', 'hollywood', 'bollywood', 'anime', 'manga', 'cartoon', 'documentary', 'comedy', 'drama', 'thriller', 'horror', 'action', 'romance', 'sci-fi', 'fantasy', 'streaming', 'theater', 'broadway', 'celebrity', 'red carpet', 'awards', 'oscar', 'emmy', 'golden globe'],
            weight: 1.0
        },
        news: {
            keywords: ['news', 'breaking', 'update', 'report', 'announcement', 'press release', 'journalism', 'reporter', 'media', 'newspaper', 'magazine', 'headline', 'story', 'article', 'investigation', 'interview', 'press conference', 'statement', 'official', 'government', 'policy', 'law', 'regulation', 'court', 'judge', 'legal', 'lawsuit', 'trial'],
            weight: 1.0
        },
        politics: {
            keywords: ['politics', 'political', 'election', 'vote', 'voting', 'candidate', 'president', 'senator', 'congress', 'parliament', 'government', 'democracy', 'republican', 'democrat', 'conservative', 'liberal', 'campaign', 'debate', 'poll', 'policy', 'legislation', 'bill', 'law', 'constitution', 'supreme court', 'mayor', 'governor', 'minister', 'prime minister', 'diplomacy', 'international relations'],
            weight: 1.0
        },
        art: {
            keywords: ['art', 'artist', 'painting', 'drawing', 'sketch', 'sculpture', 'gallery', 'museum', 'exhibition', 'creative', 'design', 'graphic design', 'illustration', 'digital art', 'traditional art', 'contemporary art', 'modern art', 'abstract', 'portrait', 'landscape', 'still life', 'street art', 'graffiti', 'mural', 'canvas', 'brush', 'paint', 'color', 'composition', 'aesthetic', 'visual', 'artwork'],
            weight: 1.0
        },
        food: {
            keywords: ['food', 'recipe', 'cooking', 'chef', 'restaurant', 'cuisine', 'meal', 'dinner', 'lunch', 'breakfast', 'brunch', 'snack', 'dessert', 'coffee', 'tea', 'wine', 'beer', 'cocktail', 'drink', 'beverage', 'kitchen', 'baking', 'grilling', 'roasting', 'frying', 'boiling', 'ingredients', 'spices', 'herbs', 'vegetarian', 'vegan', 'organic', 'healthy eating', 'diet', 'nutrition', 'foodie', 'culinary', 'gastronomy'],
            weight: 1.0
        },
        travel: {
            keywords: ['travel', 'traveling', 'trip', 'vacation', 'holiday', 'tourism', 'tourist', 'destination', 'journey', 'adventure', 'explore', 'exploration', 'backpacking', 'road trip', 'flight', 'airline', 'airport', 'hotel', 'accommodation', 'booking', 'itinerary', 'sightseeing', 'landmark', 'culture', 'local', 'international', 'domestic', 'cruise', 'beach', 'mountain', 'city break', 'solo travel', 'group travel'],
            weight: 1.0
        },
        health: {
            keywords: ['health', 'healthy', 'wellness', 'fitness', 'exercise', 'workout', 'gym', 'training', 'diet', 'nutrition', 'medical', 'medicine', 'doctor', 'hospital', 'clinic', 'treatment', 'therapy', 'mental health', 'psychology', 'mindfulness', 'meditation', 'yoga', 'pilates', 'running', 'jogging', 'cycling', 'swimming', 'strength training', 'cardio', 'weight loss', 'muscle building', 'recovery', 'injury', 'prevention'],
            weight: 1.0
        },
        science: {
            keywords: ['science', 'scientific', 'research', 'study', 'experiment', 'discovery', 'breakthrough', 'innovation', 'physics', 'chemistry', 'biology', 'astronomy', 'space', 'nasa', 'mars', 'earth', 'climate', 'environment', 'ecology', 'genetics', 'dna', 'evolution', 'quantum', 'particle', 'molecule', 'atom', 'laboratory', 'scientist', 'professor', 'university', 'academic', 'peer review', 'journal', 'publication'],
            weight: 1.0
        },
        business: {
            keywords: ['business', 'entrepreneur', 'startup', 'company', 'corporation', 'enterprise', 'finance', 'financial', 'investment', 'investor', 'stock', 'market', 'trading', 'economy', 'economic', 'money', 'revenue', 'profit', 'sales', 'marketing', 'advertising', 'brand', 'customer', 'client', 'service', 'product', 'launch', 'strategy', 'management', 'leadership', 'ceo', 'cfo', 'executive', 'meeting', 'conference', 'networking'],
            weight: 1.0
        },
        education: {
            keywords: ['education', 'learning', 'school', 'university', 'college', 'student', 'teacher', 'professor', 'instructor', 'course', 'class', 'lesson', 'study', 'studying', 'exam', 'test', 'grade', 'degree', 'diploma', 'certificate', 'curriculum', 'syllabus', 'homework', 'assignment', 'project', 'research', 'thesis', 'dissertation', 'knowledge', 'skill', 'training', 'workshop', 'seminar', 'lecture', 'tutorial', 'online learning', 'e-learning'],
            weight: 1.0
        },
        fashion: {
            keywords: ['fashion', 'style', 'clothing', 'clothes', 'outfit', 'dress', 'shirt', 'pants', 'shoes', 'accessories', 'jewelry', 'bag', 'designer', 'brand', 'luxury', 'trend', 'trendy', 'fashionable', 'stylish', 'beauty', 'makeup', 'cosmetics', 'skincare', 'hair', 'hairstyle', 'model', 'modeling', 'runway', 'fashion week', 'collection', 'seasonal', 'wardrobe', 'shopping'],
            weight: 1.0
        },
        photography: {
            keywords: ['photography', 'photo', 'picture', 'image', 'camera', 'lens', 'shot', 'capture', 'photographer', 'portrait', 'landscape', 'street photography', 'nature photography', 'wedding photography', 'event photography', 'studio', 'lighting', 'composition', 'exposure', 'aperture', 'shutter', 'iso', 'editing', 'photoshop', 'lightroom', 'filter', 'black and white', 'color', 'digital', 'film', 'vintage'],
            weight: 1.0
        }
    };

    private constructor() { }

    public static getInstance(): ContentCategorizationService {
        if (!ContentCategorizationService.instance) {
            ContentCategorizationService.instance = new ContentCategorizationService();
        }
        return ContentCategorizationService.instance;
    }

    /**
     * Categorize a note based on its content
     */
    public async categorizeNote(note: Note): Promise<string | null> {
        if (note.category) {
            return note.category; // Already categorized
        }

        const matches = this.analyzeContent(note);

        if (matches.length === 0) {
            return 'general';
        }

        // Return the category with highest confidence
        const bestMatch = matches[0];

        // Only assign category if confidence is above threshold
        if (bestMatch.confidence > 0.3) {
            // Update the note in database
            await this.updateNoteCategory(note.id, bestMatch.category);

            logger.debug(`Categorized note ${note.id} as ${bestMatch.category} (confidence: ${bestMatch.confidence})`);

            return bestMatch.category;
        }

        return 'general';
    }

    /**
     * Analyze content and return potential category matches
     */
    public analyzeContent(note: Note): CategoryMatch[] {
        const content = this.extractContent(note);
        if (!content) return [];

        const matches: CategoryMatch[] = [];
        const contentLower = content.toLowerCase();
        const words = contentLower.split(/\s+/);

        // Analyze each category
        for (const [category, config] of Object.entries(this.categoryKeywords)) {
            let score = 0;
            const matchedKeywords: string[] = [];

            // Check for keyword matches
            for (const keyword of config.keywords) {
                const keywordLower = keyword.toLowerCase();

                // Exact phrase match (higher weight)
                if (contentLower.includes(keywordLower)) {
                    const phraseWeight = keyword.split(' ').length; // Multi-word phrases get higher weight
                    score += phraseWeight * 2;
                    matchedKeywords.push(keyword);
                }

                // Individual word matches
                const keywordWords = keywordLower.split(' ');
                const matchingWords = keywordWords.filter(kw => words.includes(kw));
                if (matchingWords.length > 0) {
                    score += matchingWords.length * 0.5;
                }
            }

            // Calculate confidence based on content length and matches
            const contentLength = words.length;
            const confidence = Math.min(score / Math.max(contentLength * 0.1, 1), 1);

            if (confidence > 0.1) {
                matches.push({
                    category,
                    confidence,
                    reasons: matchedKeywords.slice(0, 5) // Top 5 matching keywords
                });
            }
        }

        // Sort by confidence
        matches.sort((a, b) => b.confidence - a.confidence);

        return matches;
    }

    /**
     * Extract content from note for analysis
     */
    private extractContent(note: Note): string {
        let content = '';

        // Add note text
        if (note.text) {
            content += note.text + ' ';
        }

        // Add hashtags (they're good category indicators)
        if (note.tags && note.tags.length > 0) {
            content += note.tags.join(' ') + ' ';
        }

        // Add content warning (might contain category hints)
        if (note.cw) {
            content += note.cw + ' ';
        }

        return content.trim();
    }

    /**
     * Update note category in database
     */
    private async updateNoteCategory(noteId: string, category: string): Promise<void> {
        try {
            await Notes.update(noteId, { category });
        } catch (error) {
            logger.error(`Failed to update note ${noteId} category:`, error as any);
        }
    }

    /**
     * Batch categorize multiple notes
     */
    public async batchCategorizeNotes(notes: Note[]): Promise<Map<string, string>> {
        const results = new Map<string, string>();

        for (const note of notes) {
            try {
                const category = await this.categorizeNote(note);
                if (category) {
                    results.set(note.id, category);
                }
            } catch (error) {
                logger.error(`Failed to categorize note ${note.id}:`, error as any);
            }
        }

        return results;
    }

    /**
     * Categorize uncategorized notes in the background
     */
    public async categorizeUncategorizedNotes(limit: number = 100): Promise<number> {
        try {
            // Get uncategorized notes
            const uncategorizedNotes = await Notes.createQueryBuilder('note')
                .where('note.category IS NULL OR note.category = :general', { general: 'general' })
                .andWhere('note.text IS NOT NULL')
                .andWhere('note.createdAt > :cutoff', {
                    cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                })
                .orderBy('note.createdAt', 'DESC')
                .limit(limit)
                .getMany();

            logger.info(`Found ${uncategorizedNotes.length} uncategorized notes to process`);

            const results = await this.batchCategorizeNotes(uncategorizedNotes);

            logger.info(`Successfully categorized ${results.size} notes`);

            return results.size;
        } catch (error) {
            logger.error('Failed to categorize uncategorized notes:', error as any);
            return 0;
        }
    }

    /**
     * Get category suggestions for text content
     */
    public getCategorySuggestions(text: string, limit: number = 3): CategoryMatch[] {
        // Create a temporary note-like object for analysis
        const tempNote = {
            id: 'temp-analysis',
            text,
            tags: [],
            createdAt: new Date(),
            userId: 'temp'
        } as unknown as Note;

        return this.analyzeContent(tempNote).slice(0, limit);
    }
}

export const contentCategorizationService = ContentCategorizationService.getInstance();