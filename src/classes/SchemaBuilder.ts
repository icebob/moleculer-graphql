import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import type { GraphQLSchema } from 'graphql';
import type { Service, Context } from 'moleculer';
import { ensureArray, buildFullActionName } from '../utils';

type ActionResolver = (parent: unknown, args: Record<string, unknown>, ctx: Context) => unknown;

interface SchemaBuilderOptions {
	resolvers?: Record<string, unknown>;
}

class SchemaBuilder {
	private service: Service;

	private typeDefs: string;

	private resolvers?: Record<string, unknown>;

	public constructor(service: Service, typeDefs: string, opts: SchemaBuilderOptions = {}) {
		this.service = service;

		const { stitchingDirectivesTypeDefs } = stitchingDirectives();

		this.typeDefs = /* GraphQL */ `
			${stitchingDirectivesTypeDefs}
			${typeDefs}
		`;

		const { resolvers } = opts;
		this.resolvers = resolvers;
	}

	public build(): GraphQLSchema {
		const rootResolver = this.createRootResolver();

		const resolvers = { ...this.resolvers, ...rootResolver };

		const { stitchingDirectivesValidator } = stitchingDirectives();

		const schema = stitchingDirectivesValidator(
			makeExecutableSchema({ typeDefs: this.typeDefs, resolvers })
		);

		return schema;
	}

	public getTypeDefs(): string {
		return this.typeDefs;
	}

	private createRootResolver() {
		interface ActionResolvers {
			queryResolvers: Record<string, ActionResolver>;
			mutationResolvers: Record<string, ActionResolver>;
		}

		if (this.service.schema.actions == null) {
			return {};
		}

		const { queryResolvers, mutationResolvers } = Object.entries(
			this.service.schema.actions
		).reduce<ActionResolvers>(
			(acc, [actionName, actionSchema]) => {
				if (typeof actionSchema !== 'object') {
					return acc;
				}

				const { graphql } = actionSchema;

				if (graphql == null) {
					return acc;
				}

				if (graphql.query != null) {
					const queries = ensureArray(graphql.query);

					queries.forEach((query) => {
						acc.queryResolvers[query] = this.makeActionResolver(actionName);
					});
				}

				if (graphql.mutation != null) {
					const mutations = ensureArray(graphql.mutation);

					mutations.forEach((mutation) => {
						acc.mutationResolvers[mutation] = this.makeActionResolver(actionName);
					});
				}

				return acc;
			},
			{ queryResolvers: {}, mutationResolvers: {} }
		);

		const rootResolver = {
			...(Object.keys(queryResolvers).length > 0 && { Query: queryResolvers }),
			...(Object.keys(mutationResolvers).length > 0 && { Mutation: mutationResolvers }),
		};

		return rootResolver;
	}

	private makeActionResolver(actionName: string): ActionResolver {
		const fullActionName = buildFullActionName(this.service.name, actionName, this.service.version);

		return (parent, args, ctx) => {
			return ctx.call(fullActionName, args);
		};
	}
}

export default SchemaBuilder;
