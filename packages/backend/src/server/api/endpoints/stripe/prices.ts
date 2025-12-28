import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';
import {
    StripeCoreService,
    StripeConfigError,
} from '@/services/stripe/index.js';

const logger = new Logger('stripe-prices');

export const meta = {
    tags: ['account'],
    requireCredential: true,
    limit: {
        duration: HOUR,
        max: 30,
    },
    errors: {
        'STRIPE_NOT_CONFIGURED': {
            message: 'Stripe is not configured properly',
            code: 'STRIPE_NOT_CONFIGURED',
            id: 'c0c9f693-bed3-4543-88aa-5a87e7bee9c3',
        },
    },
    res: {
        type: 'object',
        optional: false, nullable: false,
        properties: {
            price_id_month: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_year: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_month_mp: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_year_mp: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_gift_month_plus: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_gift_year_plus: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_gift_month_mplus: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
            price_id_gift_year_mplus: {
                type: 'object',
                optional: false, nullable: true,
                properties: {
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                },
            },
        },
    },
};

export const paramDef = {
    type: 'object',
    properties: {},
    required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    try {
        const stripe = await StripeCoreService.getClient();
        const config = await StripeCoreService.getConfig();

        const prices: Record<string, { amount: number | null; currency: string } | null> = {};

        // Helper to fetch and format price
        async function fetchPrice(priceId: string | null): Promise<{ amount: number | null; currency: string } | null> {
            if (!priceId) return null;
            try {
                const price = await stripe.prices.retrieve(priceId);
                return {
                    amount: price.unit_amount,
                    currency: price.currency,
                };
            } catch (error) {
                logger.error(`Failed to fetch price ${priceId}: ${error}`);
                return null;
            }
        }

        // Fetch all prices in parallel for better performance
        const [
            monthPlus,
            yearPlus,
            monthMPlus,
            yearMPlus,
            giftMonthPlus,
            giftYearPlus,
            giftMonthMPlus,
            giftYearMPlus,
        ] = await Promise.all([
            fetchPrice(config.prices.monthPlus),
            fetchPrice(config.prices.yearPlus),
            fetchPrice(config.prices.monthMPlus),
            fetchPrice(config.prices.yearMPlus),
            fetchPrice(config.prices.giftMonthPlus),
            fetchPrice(config.prices.giftYearPlus),
            fetchPrice(config.prices.giftMonthMPlus),
            fetchPrice(config.prices.giftYearMPlus),
        ]);

        prices.price_id_month = monthPlus;
        prices.price_id_year = yearPlus;
        prices.price_id_month_mp = monthMPlus;
        prices.price_id_year_mp = yearMPlus;
        prices.price_id_gift_month_plus = giftMonthPlus;
        prices.price_id_gift_year_plus = giftYearPlus;
        prices.price_id_gift_month_mplus = giftMonthMPlus;
        prices.price_id_gift_year_mplus = giftYearMPlus;

        // Provide fallback prices if not configured
        if (!prices.price_id_gift_month_plus) {
            prices.price_id_gift_month_plus = { amount: 500, currency: 'usd' }; // $5
        }
        if (!prices.price_id_gift_year_plus) {
            prices.price_id_gift_year_plus = { amount: 5000, currency: 'usd' }; // $50
        }
        if (!prices.price_id_gift_month_mplus) {
            prices.price_id_gift_month_mplus = { amount: 300, currency: 'usd' }; // $3
        }
        if (!prices.price_id_gift_year_mplus) {
            prices.price_id_gift_year_mplus = { amount: 3000, currency: 'usd' }; // $30
        }

        return prices;
    } catch (error: unknown) {
        if (error instanceof StripeConfigError) {
            throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
        }
        
        logger.error(`❌ PRICES: Error fetching prices: ${error}`);
        throw new ApiError({
            message: 'Failed to fetch prices',
            code: 'PRICES_FETCH_FAILED',
            id: 'prices-fetch-failed',
            httpStatusCode: 500,
        });
    }
});
