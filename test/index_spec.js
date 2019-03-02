'use strict';

const graphql = require('graphql');
const graphqlFields = require('../index');
const assert = require('assert');

describe('graphqlFields', () => {
    it('should flatten fragments', function (done) {
        let info = {};
        const schema = new graphql.GraphQLSchema({
            query: new graphql.GraphQLObjectType({
                name: 'Query',
                fields: {
                    viewer: {
                        type: new graphql.GraphQLObjectType({
                            name: 'Viewer',
                            fields: {
                                users: {
                                    args: {
                                        userId: { type: graphql.GraphQLString },
                                        first: { type: graphql.GraphQLInt },
                                        includeInactive: { type: graphql.GraphQLBoolean }
                                    },
                                    type: new graphql.GraphQLObjectType({
                                        name: 'UserConnection',
                                        fields: {
                                            pageInfo: {
                                                type: new graphql.GraphQLObjectType({
                                                    name: 'PageInfo',
                                                    fields: {
                                                        totalResults: { type: graphql.GraphQLInt }
                                                    }
                                                })
                                            },
                                            edges: {
                                                type: new graphql.GraphQLList(
                                                    new graphql.GraphQLObjectType({
                                                        name: 'UserEdge',
                                                        fields: {
                                                            cursor: { type: graphql.GraphQLString },
                                                            node: {
                                                                type: new graphql.GraphQLObjectType({
                                                                    name: 'User',
                                                                    fields: {
                                                                        addressBook: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'AddressBook',
                                                                                fields: {
                                                                                    apiType: { type: graphql.GraphQLString }
                                                                                }
                                                                            })
                                                                        },
                                                                        profile: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'Profile',
                                                                                fields: {
                                                                                    displayName: { type: graphql.GraphQLString },
                                                                                    email: { type: graphql.GraphQLString }
                                                                                }
                                                                            })
                                                                        },
                                                                        proProfile: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'ProProfile',
                                                                                fields: {
                                                                                    apiType: { type: graphql.GraphQLString }
                                                                                }
                                                                            })
                                                                        }
                                                                    }
                                                                })
                                                            }
                                                        }
                                                    })
                                                )
                                            }
                                        }
                                    })
                                }
                            }
                        }),
                        resolve(root, args, context, i) {
                            info = i;
                            return {};
                        }
                    }
                }
            })
        });


        const query = `
        query UsersRoute {
          viewer {
            users(userId:"123",first:25,includeInactive:true) @skip(if:false) {
              ...A
              ...D
                pageInfo {
                totalResults
              }

            }
          }
        }

        fragment A on UserConnection {
          edges {
            node {
              addressBook {
                apiType
              }
            }
          }
          ...B
        }
        fragment B on UserConnection {
          ...C
          edges {
            cursor
          }
        }

        fragment C on UserConnection {
          edges {
            cursor,
            node {
                profile {
                    displayName,
                    email
                }
            }
          }
        }
        fragment D on UserConnection {
          edges {
            node {
              proProfile {
                apiType
              }
            }
          }
          ...B
        }
        `;

        graphql.graphql(schema, query, null, {})
            .then(() => {
                const expected = {
                    users: {
                        pageInfo: {
                            totalResults: {}
                        },
                        edges: {
                            cursor: {},
                            node: {
                                addressBook: {
                                    apiType: {}
                                },
                                proProfile: {
                                    apiType: {}
                                },
                                profile: {
                                    displayName: {},
                                    email: {}
                                }
                            }
                        }
                    }
                };
                assert.deepStrictEqual(graphqlFields(info), expected);
                done();
            }).catch(done);
    });
    describe('should respect include/skip directives when generating the field map', () => {
      let info = {};
      const schemaString = /* GraphQL*/ `
            type Pet {
                name: String!
            }
            type Person {
                name: String!
                age: Int!
                pets: [Pet!]
            }
            type Query {
                person: Person!
            }
        `;
        const schema = graphql.buildSchema(schemaString);
        const root = {
            person(args, ctx, i) {
                info = i;
                return {
                    name: 'john doe',
                    age: 42,
                };
            },
        };
      it('does not include fields with a false include directive', done => {
        const query = /* GraphQL */ `
            query Query($shouldInclude: Boolean!){
                person {
                    name @include(if: $shouldInclude)
                    age @include(if: false) @skip(if: false)
                    pets {
                        name
                    }
                }
            }
        `;
        graphql.graphql(schema, query, root, {}, { ["shouldInclude"]: false })
            .then(() => {
                const expected = {
                    pets: {
                      name: {}
                    }
                };
                assert.deepStrictEqual(graphqlFields(info), expected);
                done();
            }).catch(done);
      });
      it('does not include fields with a true skip directive', done => {
        const query = /* GraphQL */ `
            query Query($shouldSkip: Boolean!){
                person {
                    name @skip(if: $shouldSkip)
                    age
                    pets {
                        name @skip(if: true) @include(if: true)
                    }
                }
            }
        `;
        graphql.graphql(schema, query, root, {}, { ["shouldSkip"]: true })
            .then(() => {
                const expected = {
                    age: {},
                    pets: {}
                };
                assert.deepStrictEqual(graphqlFields(info), expected);
                done();
            }).catch(done);
      });
    });
    describe('subfield argument parsing', function () {
        let info = {};
        const schemaString = /* GraphQL*/ `
            enum Species {
                CANIS_LUPUS_FAMILIARIS
                FELIS_CATUS
            }
            input SpeciesPredicatesInput {
                eq: Species
                in: [Species!]
                neq: Species
                nin: [Species!]
                # etc
            }
            input FloatPredicatesInput {
                eq: Float
                gt: Float
                gte: Float
                lt: Float
                lte: Float
                # etc
            }
            input IDPredicatesInput {
                eq: ID
                in: [ID!]
                neq: ID
                nin: [ID!]
                # etc
            }
            input IntPredicatesInput {
                eq: Int
                gt: Int
                gte: Int
                lt: Int
                lte: Int
                # etc
            }
            input SomeInput {
                bool: Boolean
                float: Float
                int: Int
                list: [String]
            }
            input StringPredicatesInput {
                eq: String
                in: [String!]
                # etc
            }
            input PetPredicatesInput {
                age: IntPredicatesInput
                fixed: Boolean!
                id: IDPredicatesInput
                name: StringPredicatesInput
                species: SpeciesPredicatesInput
                weight: FloatPredicatesInput
            }
            type Pet {
                age: Int!
                fixed: Boolean!
                id: ID!
                name: String!
                species: Species!
                weight: Float!
                nicknames: [String!]!
            }
            type Person {
                name (case: String): String!
                age: Int!
                pets(
                    id: ID,
                    fixed: Boolean,
                    name: String,
                    nicknames: [String!],
                    weight: Float,
                    limit: Int,
                    predicates: PetPredicatesInput,
                    sort: [[String]],
                    listOfSomeInput: [SomeInput]
                ): [Pet!]!
            }
            type Query {
                person: Person!
            }
        `;
        const schema = graphql.buildSchema(schemaString);
        const root = {
            person(args, ctx, i) {
                info = i;
                return {
                    name: 'john doe',
                    age: 42
                };
            }
        };

        it('should extract sub-field arguments of Variable type if options is provided', function (done) {
            const variableValues = {
                limit: 50
            };

            const query = /* GraphQL */ `
                query Query($limit: Int) {
                    person {
                        pets(limit: $limit) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                pets: {
                    __arguments: [
                        {
                            limit: {
                                kind: 'Variable',
                                value: 50
                            }
                        }
                    ],
                    name: {}
                }
            };

            graphql
                .graphql(schema, query, root, {}, variableValues)
                .then(() => {
                    const fields = graphqlFields(
                        info,
                        {},
                        { processArguments: true }
                    );
                    assert.deepStrictEqual(fields, expected);
                    done();
                });
        });

        it('should extract sub-field arguments of ListValue type if options is provided', function (done) {
            const variableValues = {
                extraNickname: 'Lucky',
            };

            const query = /* GraphQL */ `
                query Query($extraNickname: String!) {
                    person {
                        pets(nicknames: ["Fluffy", $extraNickname]) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                pets: {
                    __arguments: [
                        {
                            nicknames: {
                                kind: 'ListValue',
                                value: ['Fluffy', 'Lucky']
                            }
                        }
                    ],
                    name: {}
                }
            };

            graphql
                .graphql(schema, query, root, {}, variableValues)
                .then(error => {
                    const fields = graphqlFields(
                        info,
                        {},
                        { processArguments: true }
                    );
                    assert.deepStrictEqual(fields, expected);
                    done();
                });
        });

        it('should extract sub-field arguments of expected type if options is provided', function (done) {
            const query = /* GraphQL */ `
                {
                    person {
                        name(case: "upper")
                        age
                        pets(
                            id: "A",
                            fixed: true,
                            name: "Chopper",
                            nicknames: ["Fluffy", "Sickem"],
                            weight: 123.4,
                            limit: 10,
                            predicates: {
                                age: {
                                    gt: 2,
                                    lt: 10,
                                },
                                fixed: false,
                                id: {
                                    nin: ["B", "C"],
                                },
                                name: {
                                    eq: "Chopper",
                                },
                                species: {
                                    in: [CANIS_LUPUS_FAMILIARIS, FELIS_CATUS],
                                },
                                weight: {
                                    gt: 56.7,
                                    lt: 98.7,
                                },
                            },
                            sort: [["weight", "desc"], ["name", "asc"]],
                            listOfSomeInput: [
                                { bool: true },
                                { float: 3.14 },
                                { int: 42 },
                            ]
                        ) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                name: {
                    __arguments: [
                        {
                            case: {
                                kind: 'StringValue',
                                value: 'upper'
                            }
                        }
                    ]
                },
                age: {},
                pets: {
                    name: {},
                    __arguments: [
                        {
                            id: {
                                kind: 'StringValue', // Why not an IDValue?
                                value: 'A'
                            },
                        },
                        {
                            fixed: {
                                kind: 'BooleanValue',
                                value: true
                            },
                        },
                        {
                            name: {
                                kind: 'StringValue',
                                value: 'Chopper'
                            }
                        },
                        {
                            nicknames: {
                                kind: 'ListValue',
                                value: ['Fluffy', 'Sickem']
                            }
                        },
                        {
                            weight: {
                                kind: 'FloatValue',
                                value: 123.4
                            }
                        },
                        {
                            limit: {
                                kind: 'IntValue',
                                value: 10
                            }
                        },
                        {
                            predicates: {
                                kind: 'ObjectValue',
                                value: {
                                    age: {
                                        gt: 2,
                                        lt: 10,
                                    },
                                    fixed: false,
                                    id: {
                                        nin: ['B', 'C'],
                                    },
                                    name: {
                                        eq: 'Chopper',
                                    },
                                    species: {
                                        in: ['CANIS_LUPUS_FAMILIARIS', 'FELIS_CATUS'],
                                    },
                                    weight: {
                                        gt: 56.7,
                                        lt: 98.7,
                                    },
                                },
                            },
                        },
                        {
                            sort: {
                                kind: 'ListValue',
                                value: [
                                    ['weight', 'desc'],
                                    ['name', 'asc'],
                                ]
                            }
                        },
                        {
                            listOfSomeInput: {
                                kind: 'ListValue',
                                value: [
                                    { bool: true },
                                    { float: 3.14 },
                                    { int: 42 },
                                ]
                            }
                        }
                    ]
                }
            };
            graphql.graphql(schema, query, root, {}).then(() => {
                const fields = graphqlFields(
                    info,
                    {},
                    { processArguments: true }
                );
                assert.deepStrictEqual(fields, expected);
                done();
            });
        });

        it('should not parse arguments if not specified in options', function (done) {
            const query = /* GraphQL */ `
                {
                    person {
                        name(case: "upper")
                        age
                        pets(
                            id: "A"
                            fixed: true,
                            name: "Chopper",
                            nicknames: ["Fluffy", "Sickem"],
                            weight: 100,
                            limit: 10
                            predicates: {
                                age: {
                                    gt: 2
                                    lt: 10
                                }
                                fixed: false
                                id: {
                                    nin: ["B", "C"]
                                }
                                name: {
                                    eq: "Chopper"
                                }
                                species: {
                                    in: [CANIS_LUPUS_FAMILIARIS, FELIS_CATUS]
                                }
                                weight: {
                                    gt: 56.7
                                    lt: 98.7
                                }
                            }
                            sort: [["weight", "desc"], ["name", "asc"]]
                        ) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                name: {},
                age: {},
                pets: {
                    name: {}
                }
            };
            graphql.graphql(schema, query, root, {}).then(() => {
                const fields = graphqlFields(info);
                assert.deepStrictEqual(fields, expected);
                done();
            });
        });
    });
    describe('excluded fields', function () {
        let info = {};
        const schemaString = /* GraphQL*/ `
            type Person {
                name: String!
                age: Int!
            }
            type Query {
                person: Person!
            }
        `;
        const schema = graphql.buildSchema(schemaString);
        const root = {
            person(args, ctx, i) {
                info = i;
                return {
                    name: 'john doe',
                    age: 42,
                };
            },
        };
        const query = /* GraphQL */ `
            {
                person {
                    name
                    age
                    __typename
                }
            }
        `;
        it('Should exclude fields', function (done) {
            const expected = {
                name: {},
            };
            graphql.graphql(schema, query, root, {})
                .then(() => {
                    const fields = graphqlFields(info, {}, { excludedFields: ['__typename', 'age'] });
                    assert.deepStrictEqual(fields, expected);
                    done();
                });
        });

        it('Should not exclude fields if not specified in options', function (done) {
            const expected = {
                name: {},
                age: {},
                __typename: {},
            };
            graphql.graphql(schema, query, root, {})
                .then(() => {
                    const fields = graphqlFields(info);
                    assert.deepStrictEqual(fields, expected);
                    done();
                })
        });
    });
});
