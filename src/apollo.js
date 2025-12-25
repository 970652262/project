import { ApolloClient, InMemoryCache } from "@apollo/client";

const WORKER_URL = "https://my-worker.dryvinyu.workers.dev/graphql";

// 本地开发地址
// const WORKER_URL = "http://localhost:8787/graphql";

export const client = new ApolloClient({
  uri: WORKER_URL,
  cache: new InMemoryCache(),
});