import {
    GraphQLResolveInfo,
    FieldNode,
    SelectionNode,
    DirectiveNode,
    ValueNode,
    VariableNode,
    IntValueNode,
    FloatValueNode,
    StringValueNode,
    BooleanValueNode,
    EnumValueNode,
    ListValueNode,
} from 'graphql';

// Types

interface GraphQLFieldsOptions {
    processArguments: boolean;
    excludedFields: string[];
}

type ValueNodeWithValueField =
    | VariableNode
    | IntValueNode
    | FloatValueNode
    | StringValueNode
    | BooleanValueNode
    | EnumValueNode;

// Type gaurds

function isFieldNode(ast: SelectionNode): ast is FieldNode {
    return ast.kind === 'Field';
}

function isValueNodeWithValueField(value: ValueNode): value is ValueNodeWithValueField {
    return (value.kind !== 'NullValue' &&
        value.kind !== 'ListValue' &&
        value.kind !== 'ObjectValue');
}

function isListValueNode(value: ValueNode): value is ListValueNode {
    return value.kind === 'ListValue';
}

// Options

const options: GraphQLFieldsOptions = {
    processArguments: false,
    excludedFields: [],
};

// Helpers

function getSelections(ast: FieldNode) {
    if (ast &&
        ast.selectionSet &&
        ast.selectionSet.selections &&
        ast.selectionSet.selections.length) {
        return ast.selectionSet.selections;
    }

    return [];
}

function getAST(ast, info) {
    if (ast.kind === 'FragmentSpread') {
        const fragmentName = ast.name.value;
        return info.fragments[fragmentName];
    }
    return ast;
}

function getArguments(ast: FieldNode) {
    return ast.arguments!.map(argument => {
        const valueNode = argument.value;
        const argumentValue = (!isListValueNode(valueNode)
            ? (valueNode as any).value
            : (valueNode as any).values.map(value => value.value));

        return {
            [argument.name.value]: {
                kind: argument.value.kind,
                value: argumentValue
            },
        };
    });
}

function getDirectiveValue(directive: DirectiveNode, info: GraphQLResolveInfo) {
    const arg = directive.arguments![0]; // only arg on an include or skip directive is "if"
    if (arg.value.kind !== 'Variable') {
        const valueNode = arg.value;
        return isValueNodeWithValueField(valueNode) ? !!valueNode.value : false;
    }
    return info.variableValues[arg.value.name.value];
}

function getDirectiveResults(ast: SelectionNode, info: GraphQLResolveInfo) {
    const directiveResult = {
        shouldInclude: true,
        shouldSkip: false,
    };
    return ast.directives!.reduce((result, directive) => {
        switch (directive.name.value) {
        case 'include':
            return { ...result, shouldInclude: getDirectiveValue(directive, info) };
        case 'skip':
            return { ...result, shouldSkip: getDirectiveValue(directive, info) };
        default:
            return result;
        }
    }, directiveResult);
}

function flattenAST(ast: FieldNode, info: GraphQLResolveInfo, obj: any = {}) {
    return getSelections(ast).reduce((flattened, a) => {
        if (a.directives && a.directives.length) {
            const { shouldInclude, shouldSkip } = getDirectiveResults(a, info);
            // field/fragment is not included if either the @skip condition is true or the @include condition is false
            // https://facebook.github.io/graphql/draft/#sec--include
            if (shouldSkip || !shouldInclude) {
                return flattened;
            }
        }

        if (isFieldNode(a)) {
            const name = a.name.value;
            if (options.excludedFields.indexOf(name) !== -1) {
                return flattened;
            }

            if (flattened[name] && flattened[name] !== '__arguments') {
                Object.assign(flattened[name], flattenAST(a, info, flattened[name]));
            } else {
                flattened[name] = flattenAST(a, info);
            }

            if (options.processArguments) {
                // check if the current field has arguments
                if (a.arguments && a.arguments.length) {
                    Object.assign(flattened[name], { __arguments: getArguments(a) });
                }
            }
        } else {
            flattened = flattenAST(getAST(a, info), info, flattened);
        }

        return flattened;
    }, obj);
}

function graphqlFields(
    info: GraphQLResolveInfo,
    obj: {} = {},
    opts: Partial<GraphQLFieldsOptions> = {},
) {
    const fields: ReadonlyArray<FieldNode> = info.fieldNodes || (info as any).fieldASTs;
    options.processArguments = opts.processArguments || false;
    options.excludedFields = opts.excludedFields || [];
    return fields.reduce((o, ast) => {
        return flattenAST(ast, info, o);
    }, obj) || {};
}

// Support `import { graphqlFields } from 'graphql-fields` syntax
(module as any).graphqlFields = graphqlFields;
module.exports = graphqlFields;
