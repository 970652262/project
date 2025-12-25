// 浏览器 / Next.js
//         ↓
// Cloudflare Worker fetch
//         ↓
// 判断 pathname
//         ├── /graphql
//         │     └── GraphQL Yoga
//         │           └── Resolver
//         │                 └── DeepSeek API + Tools
//         │
//         └── /random /message
//               └── REST Response

import { createSchema, createYoga } from "graphql-yoga";

interface Env {
	DEEPSEEK_API_KEY: string;
}

/**
 * 获取天气
 */
async function getWeather(city: string): Promise<string> {
	const response = await fetch(
		`https://wttr.in/${encodeURIComponent(city)}?format=3`
	);
	return await response.text();
}

/**
 * 调用 DeepSeek API（支持工具调用）
 */
async function callDeepSeekAPI(
	prompt: string,
	apiKey: string
): Promise<string> {
	// 简单判断是否在问天气
	const weatherMatch = prompt.match(/(.+?)(?:的)?(?:天气|气温|温度|weather)/i);

	if (weatherMatch) {
		// 提取城市名
		let city = weatherMatch[1].trim();
		// 移除常见的问句词
		city = city.replace(/^(查询|查一下|看看|告诉我|请问|问一下|帮我查|今天|明天|现在)/g, '').trim();

		if (city) {
			const weather = await getWeather(city);
			// 让 AI 基于天气数据生成自然回复
			const response = await fetch("https://api.deepseek.com/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "deepseek-chat",
					messages: [
						{ role: "system", content: "你是一个友好的助手。用户询问天气，以下是实时天气数据，请基于此数据用自然的中文回复用户。" },
						{ role: "user", content: `用户问: ${prompt}\n\n实时天气数据: ${weather}` },
					],
				}),
			});

			const data = (await response.json()) as {
				choices?: Array<{ message: { content: string } }>;
				error?: { message: string };
			};

			if (data.error) {
				throw new Error(`DeepSeek API error: ${data.error.message}`);
			}

			return data.choices?.[0]?.message?.content ?? weather;
		}
	}

	// 普通对话
	const response = await fetch("https://api.deepseek.com/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "deepseek-chat",
			messages: [
				{ role: "system", content: "You are a helpful assistant." },
				{ role: "user", content: prompt },
			],
		}),
	});

	const data = (await response.json()) as {
		choices?: Array<{ message: { content: string } }>;
		error?: { message: string };
	};

	if (data.error) {
		throw new Error(`DeepSeek API error: ${data.error.message}`);
	}

	return data.choices?.[0]?.message?.content ?? "";
}

/**
 * 创建 GraphQL Schema
 */
function createGraphQLSchema(env: Env) {
	return createSchema({
		typeDefs: /* GraphQL */ `
      type Query {
        hello: String!
        random: String!
        message: String!
        weather(city: String!): String!
        ai(prompt: String!): String!
      }
    `,
		resolvers: {
			Query: {
				hello: () => "Hello, world!",
				random: () => crypto.randomUUID(),
				message: () =>
					"This is a message from GraphQL Yoga on Cloudflare Workers!",
				ai: async (_parent, args: { prompt: string }) => {
					return await callDeepSeekAPI(args.prompt, env.DEEPSEEK_API_KEY);
				},
				weather: async (_parent, args: { city: string }) => {
					return await getWeather(args.city);
				},
			},
		},
	});
}

/**
 * Worker 入口
 */
export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/graphql") {
			const schema = createGraphQLSchema(env);

			const yoga = createYoga({
				schema,
				graphqlEndpoint: "/graphql",
				cors: {
					origin: "*",
					methods: ["GET", "POST", "OPTIONS"],
					allowedHeaders: ["Content-Type"],
				},
			});

			return yoga.fetch(request, env, ctx);
		}

		switch (url.pathname) {
			case "/message":
				return new Response("Hello, World!");
			case "/random":
				return new Response(crypto.randomUUID());
			case "/":
				return new Response(
					"Worker is running! Visit /graphql for GraphQL Playground."
				);
			default:
				return new Response("Not Found", { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
