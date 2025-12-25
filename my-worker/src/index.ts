// 浏览器 / Next.js
//         ↓
// Cloudflare Worker fetch
//         ↓
// 判断 pathname
//         ├── /graphql
//         │     └── GraphQL Yoga
//         │           └── Resolver
//         │                 └── DeepSeek API
//         │
//         └── /random /message
//               └── REST Response

import { createSchema, createYoga } from "graphql-yoga";

/**
 * Cloudflare Worker 环境变量类型
 */
interface Env {
	DEEPSEEK_API_KEY: string;
}

/**
 * 调用 DeepSeek API
 */
async function callDeepSeekAPI(
	prompt: string,
	apiKey: string
): Promise<string> {
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
 * 根据 env 创建 GraphQL Schema
 */
function createGraphQLSchema(env: Env) {
	return createSchema({
		typeDefs: /* GraphQL */ `
      type Query {
        hello: String!
        random: String!
        message: String!
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

		/**
		 * GraphQL 路由
		 */
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

		/**
		 * REST API
		 */
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
