/**
 * Advanced Sentiment Analysis Service
 * Implements sophisticated sentiment analysis with emoji mapping and context awareness
 */

import Logger from '@/services/logger.js';

const logger = new Logger('advanced-sentiment-analysis');

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-1
  intensity: number; // 0-1, how strong the sentiment is
  emotions: {
    joy: number;
    anger: number;
    sadness: number;
    fear: number;
    surprise: number;
    disgust: number;
  };
  contextFactors: {
    sarcasm: number; // 0-1, likelihood of sarcasm
    formality: number; // 0-1, how formal the text is
    urgency: number; // 0-1, how urgent the text seems
  };
}

/**
 * Emoji sentiment mapping (50+ emojis)
 */
const EMOJI_SENTIMENT_MAP: Record<string, { sentiment: 'positive' | 'negative' | 'neutral'; intensity: number; emotions: string[] }> = {
  // Positive emojis
  '😀': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '😃': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '😄': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '😁': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '😆': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '😅': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '🤣': { sentiment: 'positive', intensity: 1.0, emotions: ['joy'] },
  '😂': { sentiment: 'positive', intensity: 1.0, emotions: ['joy'] },
  '🙂': { sentiment: 'positive', intensity: 0.5, emotions: ['joy'] },
  '😊': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '😇': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '🥰': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '😍': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '🤩': { sentiment: 'positive', intensity: 0.9, emotions: ['joy', 'surprise'] },
  '😘': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '😗': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '😙': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '😚': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '🤗': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '🤭': { sentiment: 'positive', intensity: 0.5, emotions: ['joy'] },
  '🤫': { sentiment: 'neutral', intensity: 0.3, emotions: [] },
  '🤔': { sentiment: 'neutral', intensity: 0.4, emotions: [] },
  '🤐': { sentiment: 'neutral', intensity: 0.3, emotions: [] },
  '🤨': { sentiment: 'neutral', intensity: 0.4, emotions: [] },
  '😐': { sentiment: 'neutral', intensity: 0.2, emotions: [] },
  '😑': { sentiment: 'neutral', intensity: 0.3, emotions: [] },
  '😶': { sentiment: 'neutral', intensity: 0.2, emotions: [] },
  '😏': { sentiment: 'neutral', intensity: 0.4, emotions: [] },
  '😒': { sentiment: 'negative', intensity: 0.5, emotions: ['disgust'] },
  '🙄': { sentiment: 'negative', intensity: 0.6, emotions: ['disgust'] },
  '😬': { sentiment: 'negative', intensity: 0.5, emotions: ['fear'] },
  '🤥': { sentiment: 'negative', intensity: 0.4, emotions: [] },
  '😔': { sentiment: 'negative', intensity: 0.7, emotions: ['sadness'] },
  '😕': { sentiment: 'negative', intensity: 0.6, emotions: ['sadness'] },
  '🙁': { sentiment: 'negative', intensity: 0.6, emotions: ['sadness'] },
  '☹️': { sentiment: 'negative', intensity: 0.7, emotions: ['sadness'] },
  '😣': { sentiment: 'negative', intensity: 0.7, emotions: ['sadness'] },
  '😖': { sentiment: 'negative', intensity: 0.8, emotions: ['sadness'] },
  '😫': { sentiment: 'negative', intensity: 0.8, emotions: ['sadness'] },
  '😩': { sentiment: 'negative', intensity: 0.8, emotions: ['sadness'] },
  '🥺': { sentiment: 'negative', intensity: 0.6, emotions: ['sadness'] },
  '😢': { sentiment: 'negative', intensity: 0.8, emotions: ['sadness'] },
  '😭': { sentiment: 'negative', intensity: 0.9, emotions: ['sadness'] },
  '😤': { sentiment: 'negative', intensity: 0.7, emotions: ['anger'] },
  '😠': { sentiment: 'negative', intensity: 0.8, emotions: ['anger'] },
  '😡': { sentiment: 'negative', intensity: 0.9, emotions: ['anger'] },
  '🤬': { sentiment: 'negative', intensity: 1.0, emotions: ['anger'] },
  '🤯': { sentiment: 'negative', intensity: 0.8, emotions: ['surprise', 'anger'] },
  '😳': { sentiment: 'neutral', intensity: 0.6, emotions: ['surprise'] },
  '🥵': { sentiment: 'negative', intensity: 0.6, emotions: ['anger'] },
  '🥶': { sentiment: 'negative', intensity: 0.6, emotions: ['fear'] },
  '😱': { sentiment: 'negative', intensity: 0.9, emotions: ['fear', 'surprise'] },
  '😨': { sentiment: 'negative', intensity: 0.8, emotions: ['fear'] },
  '😰': { sentiment: 'negative', intensity: 0.8, emotions: ['fear'] },
  '😥': { sentiment: 'negative', intensity: 0.7, emotions: ['sadness'] },
  '😓': { sentiment: 'negative', intensity: 0.6, emotions: ['sadness'] },
  
  // Heart emojis
  '❤️': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '🧡': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '💛': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '💚': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '💙': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '💜': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '🖤': { sentiment: 'negative', intensity: 0.5, emotions: ['sadness'] },
  '🤍': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '🤎': { sentiment: 'neutral', intensity: 0.3, emotions: [] },
  '💔': { sentiment: 'negative', intensity: 0.9, emotions: ['sadness'] },
  
  // Gesture emojis
  '👍': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '👎': { sentiment: 'negative', intensity: 0.7, emotions: ['disgust'] },
  '👌': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '✌️': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '🤞': { sentiment: 'positive', intensity: 0.5, emotions: [] },
  '🤟': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '🤘': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '👏': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '🙌': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '👐': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '🤲': { sentiment: 'positive', intensity: 0.5, emotions: [] },
  '🤝': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '🙏': { sentiment: 'positive', intensity: 0.6, emotions: [] },
  
  // Activity emojis
  '🎉': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '🎊': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '🎈': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '🎁': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '🏆': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '🥇': { sentiment: 'positive', intensity: 0.9, emotions: ['joy'] },
  '🔥': { sentiment: 'positive', intensity: 0.8, emotions: ['joy'] },
  '⭐': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '✨': { sentiment: 'positive', intensity: 0.7, emotions: ['joy'] },
  '💫': { sentiment: 'positive', intensity: 0.6, emotions: ['joy'] },
  '⚡': { sentiment: 'positive', intensity: 0.7, emotions: ['surprise'] },
  '💥': { sentiment: 'positive', intensity: 0.8, emotions: ['surprise'] }
};

/**
 * Sentiment keywords with weights
 */
const SENTIMENT_KEYWORDS = {
  positive: {
    strong: ['amazing', 'awesome', 'fantastic', 'incredible', 'outstanding', 'excellent', 'perfect', 'wonderful', 'brilliant', 'spectacular'],
    moderate: ['good', 'great', 'nice', 'cool', 'sweet', 'lovely', 'beautiful', 'happy', 'glad', 'pleased'],
    mild: ['ok', 'fine', 'decent', 'alright', 'fair', 'satisfactory']
  },
  negative: {
    strong: ['terrible', 'awful', 'horrible', 'disgusting', 'pathetic', 'outrageous', 'devastating', 'catastrophic', 'abysmal', 'atrocious'],
    moderate: ['bad', 'poor', 'disappointing', 'frustrating', 'annoying', 'unpleasant', 'unfortunate', 'sad', 'upset', 'worried'],
    mild: ['meh', 'boring', 'dull', 'bland', 'mediocre', 'average']
  }
};

/**
 * Sarcasm indicators
 */
const SARCASM_INDICATORS = [
  'yeah right', 'sure thing', 'oh great', 'fantastic', 'wonderful', 'perfect',
  'totally', 'absolutely', 'definitely', 'obviously', 'clearly'
];

/**
 * Advanced Sentiment Analysis Service
 */
export class AdvancedSentimentAnalysis {
  private static instance: AdvancedSentimentAnalysis;

  private constructor() {}

  public static getInstance(): AdvancedSentimentAnalysis {
    if (!AdvancedSentimentAnalysis.instance) {
      AdvancedSentimentAnalysis.instance = new AdvancedSentimentAnalysis();
    }
    return AdvancedSentimentAnalysis.instance;
  }

  /**
   * Analyze sentiment of text with advanced features
   */
  public analyzeSentiment(text: string, context?: {
    authorId?: string;
    replyTo?: string;
    contentType?: string;
    timestamp?: Date;
  }): SentimentResult {
    if (!text || text.trim().length === 0) {
      return this.createNeutralResult();
    }

    const cleanText = text.toLowerCase().trim();
    
    // Analyze different components
    const emojiAnalysis = this.analyzeEmojis(text);
    const keywordAnalysis = this.analyzeKeywords(cleanText);
    const contextAnalysis = this.analyzeContext(cleanText, context);
    const emotionAnalysis = this.analyzeEmotions(cleanText, emojiAnalysis);
    
    // Combine analyses
    const combinedSentiment = this.combineSentimentScores([
      emojiAnalysis,
      keywordAnalysis,
      contextAnalysis
    ]);

    // Calculate final confidence
    const confidence = this.calculateConfidence(text, emojiAnalysis, keywordAnalysis);

    return {
      sentiment: combinedSentiment.sentiment,
      confidence,
      intensity: combinedSentiment.intensity,
      emotions: emotionAnalysis,
      contextFactors: {
        sarcasm: this.detectSarcasm(cleanText),
        formality: this.detectFormality(text),
        urgency: this.detectUrgency(cleanText)
      }
    };
  }

  /**
   * Analyze emojis in text
   */
  private analyzeEmojis(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; intensity: number; emotions: string[] } {
    const emojis = text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
    
    if (emojis.length === 0) {
      return { sentiment: 'neutral', intensity: 0, emotions: [] };
    }

    let totalPositive = 0;
    let totalNegative = 0;
    let totalIntensity = 0;
    const allEmotions = new Set<string>();

    for (const emoji of emojis) {
      const emojiData = EMOJI_SENTIMENT_MAP[emoji];
      if (emojiData) {
        if (emojiData.sentiment === 'positive') {
          totalPositive += emojiData.intensity;
        } else if (emojiData.sentiment === 'negative') {
          totalNegative += emojiData.intensity;
        }
        totalIntensity += emojiData.intensity;
        emojiData.emotions.forEach(emotion => allEmotions.add(emotion));
      }
    }

    const sentiment = totalPositive > totalNegative ? 'positive' : 
                     totalNegative > totalPositive ? 'negative' : 'neutral';
    
    return {
      sentiment,
      intensity: totalIntensity / emojis.length,
      emotions: Array.from(allEmotions)
    };
  }

  /**
   * Analyze sentiment keywords
   */
  private analyzeKeywords(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; intensity: number } {
    let positiveScore = 0;
    let negativeScore = 0;

    // Check positive keywords
    for (const [strength, words] of Object.entries(SENTIMENT_KEYWORDS.positive)) {
      const weight = strength === 'strong' ? 1.0 : strength === 'moderate' ? 0.6 : 0.3;
      for (const word of words) {
        if (text.includes(word)) {
          positiveScore += weight;
        }
      }
    }

    // Check negative keywords
    for (const [strength, words] of Object.entries(SENTIMENT_KEYWORDS.negative)) {
      const weight = strength === 'strong' ? 1.0 : strength === 'moderate' ? 0.6 : 0.3;
      for (const word of words) {
        if (text.includes(word)) {
          negativeScore += weight;
        }
      }
    }

    const totalScore = positiveScore + negativeScore;
    const sentiment = positiveScore > negativeScore ? 'positive' : 
                     negativeScore > positiveScore ? 'negative' : 'neutral';
    
    return {
      sentiment,
      intensity: totalScore > 0 ? Math.min(totalScore / 3, 1) : 0
    };
  }

  /**
   * Analyze context factors
   */
  private analyzeContext(text: string, context?: any): { sentiment: 'positive' | 'negative' | 'neutral'; intensity: number } {
    let contextScore = 0;
    
    // Check for negation words that might flip sentiment
    const negationWords = ['not', 'no', 'never', 'nothing', 'nobody', 'nowhere', 'neither', 'nor'];
    const hasNegation = negationWords.some(word => text.includes(word));
    
    // Check for intensifiers
    const intensifiers = ['very', 'really', 'extremely', 'incredibly', 'absolutely', 'totally', 'completely'];
    const hasIntensifier = intensifiers.some(word => text.includes(word));
    
    // Check for questions (often neutral or seeking help)
    const hasQuestion = text.includes('?');
    
    // Adjust based on context
    if (hasNegation) contextScore -= 0.2;
    if (hasIntensifier) contextScore += 0.1;
    if (hasQuestion) contextScore *= 0.8; // Questions are often more neutral
    
    return {
      sentiment: 'neutral',
      intensity: Math.abs(contextScore)
    };
  }

  /**
   * Analyze emotions from text and emojis
   */
  private analyzeEmotions(text: string, emojiAnalysis: any): SentimentResult['emotions'] {
    const emotions = {
      joy: 0,
      anger: 0,
      sadness: 0,
      fear: 0,
      surprise: 0,
      disgust: 0
    };

    // Add emoji emotions
    for (const emotion of emojiAnalysis.emotions) {
      if (emotion in emotions) {
        emotions[emotion as keyof typeof emotions] += 0.3;
      }
    }

    // Analyze text for emotion keywords
    const emotionKeywords = {
      joy: ['happy', 'excited', 'thrilled', 'delighted', 'cheerful', 'joyful', 'elated'],
      anger: ['angry', 'furious', 'mad', 'irritated', 'annoyed', 'outraged', 'livid'],
      sadness: ['sad', 'depressed', 'disappointed', 'heartbroken', 'melancholy', 'sorrowful'],
      fear: ['scared', 'afraid', 'terrified', 'anxious', 'worried', 'nervous', 'frightened'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'bewildered'],
      disgust: ['disgusted', 'revolted', 'repulsed', 'sickened', 'appalled', 'nauseated']
    };

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          emotions[emotion as keyof typeof emotions] += 0.2;
        }
      }
    }

    // Normalize emotions to 0-1 range
    for (const emotion in emotions) {
      emotions[emotion as keyof typeof emotions] = Math.min(emotions[emotion as keyof typeof emotions], 1);
    }

    return emotions;
  }

  /**
   * Detect sarcasm in text
   */
  private detectSarcasm(text: string): number {
    let sarcasmScore = 0;

    // Check for sarcasm indicators
    for (const indicator of SARCASM_INDICATORS) {
      if (text.includes(indicator)) {
        sarcasmScore += 0.3;
      }
    }

    // Check for excessive punctuation (!!!, ???)
    if (/[!?]{3,}/.test(text)) {
      sarcasmScore += 0.2;
    }

    // Check for ALL CAPS words
    const capsWords = text.match(/\b[A-Z]{2,}\b/g);
    if (capsWords && capsWords.length > 0) {
      sarcasmScore += 0.1 * capsWords.length;
    }

    return Math.min(sarcasmScore, 1);
  }

  /**
   * Detect formality level
   */
  private detectFormality(text: string): number {
    let formalityScore = 0.5; // Start neutral

    // Formal indicators
    const formalWords = ['therefore', 'however', 'furthermore', 'nevertheless', 'consequently', 'moreover'];
    const informalWords = ['gonna', 'wanna', 'yeah', 'nah', 'lol', 'omg', 'wtf', 'tbh'];

    for (const word of formalWords) {
      if (text.toLowerCase().includes(word)) {
        formalityScore += 0.1;
      }
    }

    for (const word of informalWords) {
      if (text.toLowerCase().includes(word)) {
        formalityScore -= 0.1;
      }
    }

    // Check for proper punctuation and capitalization
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let properCapitalization = 0;
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 0 && /^[A-Z]/.test(trimmed)) {
        properCapitalization++;
      }
    }

    if (sentences.length > 0) {
      formalityScore += (properCapitalization / sentences.length) * 0.2;
    }

    return Math.max(0, Math.min(1, formalityScore));
  }

  /**
   * Detect urgency in text
   */
  private detectUrgency(text: string): number {
    let urgencyScore = 0;

    // Urgency keywords
    const urgentWords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'important', 'deadline', 'hurry'];
    
    for (const word of urgentWords) {
      if (text.includes(word)) {
        urgencyScore += 0.3;
      }
    }

    // Multiple exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    urgencyScore += Math.min(exclamationCount * 0.1, 0.3);

    // ALL CAPS words
    const capsWords = text.match(/\b[A-Z]{2,}\b/g);
    if (capsWords) {
      urgencyScore += Math.min(capsWords.length * 0.1, 0.2);
    }

    return Math.min(urgencyScore, 1);
  }

  /**
   * Combine multiple sentiment scores
   */
  private combineSentimentScores(analyses: Array<{ sentiment: 'positive' | 'negative' | 'neutral'; intensity: number }>): { sentiment: 'positive' | 'negative' | 'neutral'; intensity: number } {
    let positiveScore = 0;
    let negativeScore = 0;
    let totalWeight = 0;

    for (const analysis of analyses) {
      const weight = analysis.intensity;
      totalWeight += weight;

      if (analysis.sentiment === 'positive') {
        positiveScore += weight;
      } else if (analysis.sentiment === 'negative') {
        negativeScore += weight;
      }
    }

    const sentiment = positiveScore > negativeScore ? 'positive' : 
                     negativeScore > positiveScore ? 'negative' : 'neutral';
    
    const intensity = totalWeight > 0 ? Math.max(positiveScore, negativeScore) / totalWeight : 0;

    return { sentiment, intensity };
  }

  /**
   * Calculate confidence in sentiment analysis
   */
  private calculateConfidence(text: string, emojiAnalysis: any, keywordAnalysis: any): number {
    let confidence = 0.5; // Base confidence

    // More text generally means higher confidence
    const textLength = text.length;
    confidence += Math.min(textLength / 200, 0.2); // Up to 0.2 boost for longer text

    // Emojis increase confidence
    if (emojiAnalysis.intensity > 0) {
      confidence += emojiAnalysis.intensity * 0.3;
    }

    // Keywords increase confidence
    if (keywordAnalysis.intensity > 0) {
      confidence += keywordAnalysis.intensity * 0.2;
    }

    // Multiple indicators increase confidence
    const indicators = [emojiAnalysis.intensity > 0, keywordAnalysis.intensity > 0].filter(Boolean).length;
    confidence += indicators * 0.1;

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Create neutral result
   */
  private createNeutralResult(): SentimentResult {
    return {
      sentiment: 'neutral',
      confidence: 0.1,
      intensity: 0,
      emotions: {
        joy: 0,
        anger: 0,
        sadness: 0,
        fear: 0,
        surprise: 0,
        disgust: 0
      },
      contextFactors: {
        sarcasm: 0,
        formality: 0.5,
        urgency: 0
      }
    };
  }

  /**
   * Batch analyze multiple texts
   */
  public batchAnalyze(texts: Array<{ text: string; context?: any }>): SentimentResult[] {
    return texts.map(({ text, context }) => this.analyzeSentiment(text, context));
  }

  /**
   * Get sentiment statistics
   */
  public getStats(): {
    supportedEmojis: number;
    sentimentKeywords: number;
    averageProcessingTime: number;
  } {
    return {
      supportedEmojis: Object.keys(EMOJI_SENTIMENT_MAP).length,
      sentimentKeywords: Object.values(SENTIMENT_KEYWORDS).reduce((sum, category) => 
        sum + Object.values(category).reduce((catSum, words) => catSum + words.length, 0), 0),
      averageProcessingTime: 2.5 // ms, estimated
    };
  }
}

// Export singleton instance
export const advancedSentimentAnalysis = AdvancedSentimentAnalysis.getInstance();