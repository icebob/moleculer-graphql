import { readFileSync } from 'fs';
import path from 'path';
import type { Context, ServiceBroker } from 'moleculer';
import { Service } from 'moleculer';
import { serviceMixin } from '../../src';

const typeDefs = readFileSync(path.join(__dirname, './post.graphql'), 'utf8');

interface Post {
	id: string;
	authorId: string;
	message: string;
}

interface PostAuthor {
	id: string;
}

const posts: Post[] = [
	{
		id: '1',
		authorId: '1',
		message: 'This is a test',
	},
	{
		id: '2',
		authorId: '2',
		message: "How can we live without our lives? How will we know it's us without our past?",
	},
];

class PostService extends Service {
	public constructor(broker: ServiceBroker) {
		super(broker);

		this.parseServiceSchema({
			name: 'post',
			mixins: [
				serviceMixin({
					typeDefs,
					resolvers: {
						Author: {
							posts: (parent: PostAuthor, args, context: Context) => {
								context.broker.logger.debug('Executing Author.posts resolver');
								return posts.filter((post) => {
									return parent.id === post.authorId;
								});
							},
						},
						Post: {
							author: (parent: Post, args, context: Context): PostAuthor => {
								context.broker.logger.debug('Executing Post.author resolver');
								return { id: parent.authorId };
							},
							error: (): never => {
								throw new Error('Test of a property which throws errors');
							},
						},
						Query: {
							postAuthorById: (
								parent: unknown,
								args: { authorIds: string[] },
								context: Context,
							): PostAuthor[] => {
								context.broker.logger.debug('Executing Query.postAuthorById resolver');
								const { authorIds } = args;

								return authorIds.map((id: string) => {
									return { id };
								});
							},
						},
					},
				}),
			],
			actions: {
				postById: {
					handler(ctx: Context<{ id: string }>) {
						const { id } = ctx.params;

						const result = posts.find((post) => post.id === id);

						return result;
					},
					graphql: {
						query: 'postById',
					},
				},
				postsById: {
					handler(ctx: Context<{ ids: string[] }>) {
						const { ids } = ctx.params;

						const result = posts.filter((post) => {
							return ids.includes(post.id);
						});

						return result;
					},
					graphql: {
						query: 'postsById',
					},
				},
			},
		});
	}
}

export default PostService;
