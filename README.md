# graphql-fields
Turns GraphQLResolveInfo into a map of the requested fields. Flattens all fragments and duplicated fields into a neat object to easily see which fields were requested at any level.

## Usage

Schema Type definition
```javascript
const graphqlFields = require('graphql-fields');
const graphql = require('graphql')

module.exports = new graphql.GraphQLObjectType({
    name: 'User',
    fields: {
        profile: {type: new graphql.GraphQLObjectType({
          name: 'Profile',
          fields: {
            firstName: {type: graphql.GraphQLString},
            lastName: {type: graphql.GraphQLString},
            middleName: {type: graphql.GraphQLString}
          }
        }),
        email: {type: graphql.GraphQLString},
        id: {type: graphql.GraphQLID}
    },
    resolve(root, args, context, info) {
      console.log(
        JSON.stringify(graphqlFields(info), null, 2);
      );
      ...
    }
});
```

Query
```graphql
{
  user {
    ...A
    profile {
      ...B
      firstName
    }
  }
}

fragment A on User {
  ...C
  id,
  profile {
    lastName
  }
}

Fragment B on Profile {
  firstName
}

Fragment C on User {
  email,
  profile {
    middleName
  }
}
```

will log
```json
{
  "profile": {
    "firstName": {},
    "lastName": {},
    "middleName": {}
  },
  "email": {},
  "id": {}
}

```

## Why
An underlying REST api may only return fields based on query params.
```graphql
{
  user {
    profile {
      firstName
    },
    id
  }
}
```
should request /api/user?fields=profile,id

while
```graphql
{
  user {
    email
  }
}
```
should request /api/user?fields=email

Implement your resolve method like so:

```
resolve(root, args, context, info) {
    const topLevelFields = Object.keys(graphqlFields(info));
    return fetch(`/api/user?fields=${topLevelFields.join(',')}`);
}
```

## Tests
```
npm test
```
