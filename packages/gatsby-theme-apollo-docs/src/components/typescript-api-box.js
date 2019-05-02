import PropTypes from 'prop-types';
import React, {Component, Fragment, createContext} from 'react';
import extend from 'lodash/extend';
import partition from 'lodash/partition';
import styled from '@emotion/styled';
import {colors} from 'gatsby-theme-apollo';

const Container = styled.div({
  border: `1px solid ${colors.divider}`,
  borderRadius: 4,
  margin: '1.5em 0',
  overflow: 'hidden'
});

const Header = styled.div({
  padding: '1.25rem',
  backgroundColor: colors.background
});

const Body = styled.div({
  padding: '1.25rem'
});

// function _link(id, name) {
//   return `<a href="#${id}">${name || id}</a>`;
// }

function _summary(rawData) {
  if (rawData.comment) {
    return rawData.comment.shortText;
  }
  return (
    rawData.signatures &&
    rawData.signatures[0].comment &&
    rawData.signatures[0].comment.shortText
  );
}

function _isReflectedProperty(data) {
  return (
    data.kindString === 'Property' &&
    data.type &&
    data.type.type === 'reflection'
  );
}

function _parameterString(names, leftDelim, rightDelim) {
  leftDelim = leftDelim || '(';
  rightDelim = rightDelim || ')';
  return leftDelim + names.join(', ') + rightDelim;
}

function _typeId(type) {
  return type.fullName || type.name;
}

function isReadableName(name) {
  return name.substring(0, 2) !== '__';
}

export default class TypescriptApiBox extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired
  };

  get dataByKey() {
    const dataByKey = {};

    function traverse(tree, parentName) {
      let name = tree.name;
      if (['Constructor', 'Method', 'Property'].includes(tree.kindString)) {
        name = `${parentName}.${tree.name}`;
        // add the parentName to the data so we can reference it for ids
        tree.parentName = parentName;
        tree.fullName = name;
      }

      dataByKey[name] = tree;

      if (tree.children) {
        tree.children.forEach(child => {
          traverse(child, name);
        });
      }
    }

    traverse(this.context.data);

    return dataByKey;
  }

  templateArgs(rawData) {
    const parameters = this._parameters(rawData, this.dataByKey);
    const split = partition(parameters, 'isOptions');

    const groups = [];
    if (split[1].length > 0) {
      groups.push({
        name: 'Arguments',
        members: split[1]
      });
    }
    if (split[0].length > 0) {
      groups.push({
        name: 'Options',
        // the properties of the options parameter are the things listed in this group
        members: split[0][0].properties
      });
    }

    if ('Interface' === rawData.kindString) {
      groups.push({
        name: 'Properties',
        members: this._objectProperties(rawData)
      });
    }

    let type;
    if ('Type alias' === rawData.kindString) {
      // this means it's an object type
      if (rawData.type.declaration && rawData.type.declaration.children) {
        groups.push({
          name: 'Properties',
          members: this._objectProperties(rawData.type.declaration)
        });
      } else {
        type = this._type(rawData);
      }
    }

    return {
      id: _typeId(rawData),
      name: rawData.name,
      type,
      signature: this._signature(rawData, parameters),
      summary: _summary(rawData),
      groups,
      repo: 'apollostack/apollo-client',
      filepath: this.context.filepathPrefix + rawData.sources[0].fileName,
      lineno: rawData.sources[0].line
    };
  }

  // This is just literally the name of the type, nothing fancy, except for references
  _typeName = type => {
    if (type.type === 'instrinct') {
      if (type.isArray) {
        return '[' + type.name + ']';
      }
      return type.name;
    } else if (type.type === 'union') {
      const typeNames = [];
      for (let i = 0; i < type.types.length; i++) {
        // Try to get the type name for this type.
        const typeName = this._typeName(type.types[i]);
        // Propogate undefined type names by returning early. Otherwise just add the
        // type name to our array.
        if (typeof typeName === 'undefined') {
          return;
        } else {
          typeNames.push(typeName);
        }
      }
      // Join all of the types together.
      return typeNames.join(' | ');
    } else if (type.type === 'reference') {
      // check to see if the reference type is a simple type alias
      const referencedData = this.dataByKey[type.name];
      if (referencedData && referencedData.kindString === 'Type alias') {
        // Is it an "objecty" type? We can't display it in one line if so
        if (
          !referencedData.type.declaration ||
          !referencedData.type.declaration.children
        ) {
          return this._type(referencedData);
        }
      }

      // it used to be this: return _link(_typeId(type), type.name);
      return _typeId(type);
    } else if (type.type === 'stringLiteral') {
      return '"' + type.value + '"';
    }
  };

  _objectProperties(rawData) {
    const signatures = Array.isArray(rawData.indexSignature)
      ? rawData.indexSignature
      : [];
    return signatures
      .map(signature => {
        const parameterString = this._indexParameterString(signature);
        return extend(this._parameter(signature), {name: parameterString});
      })
      .concat(rawData.children.map(this._parameter));
  }

  _indexParameterString(signature) {
    const parameterNamesAndTypes = signature.parameters.map(
      param => param.name + ':' + this._typeName(param.type)
    );
    return _parameterString(parameterNamesAndTypes, '[', ']');
  }

  // Render the type of a data object. It's pretty confusing, to say the least
  _type = (data, skipSignature) => {
    const type = data.type;

    if (data.kindString === 'Method') {
      return this._type(data.signatures[0]);
    }

    if (data.kindString === 'Call signature' && !skipSignature) {
      const paramTypes = Array.isArray(data.parameters)
        ? data.parameters.map(this._type)
        : [];
      const args = '(' + paramTypes.join(', ') + ')';
      return args + ' => ' + this._type(data, true);
    }

    const isReflected =
      data.kindString === 'Type alias' || type.type === 'reflection';
    if (isReflected && type.declaration) {
      const declaration = type.declaration;
      if (declaration.signatures) {
        return this._type(declaration.signatures[0]);
      }

      if (declaration.indexSignature) {
        const signature = declaration.indexSignature[0];
        return (
          this._indexParameterString(signature) + ':' + this._type(signature)
        );
      }
    }

    let typeName = this._typeName(type);
    if (!typeName) {
      console.error(
        'unknown type name for',
        data.name,
        'using the type name `any`'
      );
      // console.trace();
      typeName = 'any';
    }

    if (type.typeArguments) {
      return (
        typeName +
        _parameterString(type.typeArguments.map(this._typeName), '<', '>')
      );
    }
    return typeName;
  };

  // XXX: not sure whether to use the 'kind' enum from TS or just run with the
  // strings. Strings seem safe enough I guess
  _signature(rawData, parameters) {
    let dataForSignature = rawData;
    if (_isReflectedProperty(rawData)) {
      dataForSignature = rawData.type.declaration;
    }

    const escapedName = escape(rawData.name);

    // if it is a function, and therefore has arguments
    const signature =
      dataForSignature.signatures && dataForSignature.signatures[0];
    if (signature) {
      const name = rawData.name;
      const parameterString = _parameterString(
        parameters.map(param => param.name)
      );
      let returnType = '';
      if (rawData.kindString !== 'Constructor') {
        const type = this._type(signature, true);
        if (type !== 'void') {
          returnType = ': ' + this._type(signature, true);
        }
      }

      return name + parameterString + returnType;
    }

    return escapedName;
  }

  _parameter = param => ({
    name: param.name,
    type: this._type(param),
    description:
      param.comment && (param.comment.text || param.comment.shortText)
  });

  // Takes the data about a function / constructor and parses out the named params
  _parameters(rawData, dataByKey) {
    if (_isReflectedProperty(rawData)) {
      return this._parameters(rawData.type.declaration, dataByKey);
    }

    const signature = rawData.signatures && rawData.signatures[0];
    if (!signature || !Array.isArray(signature.parameters)) {
      return [];
    }

    return signature.parameters.map(param => {
      let name;
      if (isReadableName(param.name)) {
        name = param.name;
      } else if (isReadableName(param.originalName)) {
        name = param.originalName;
      } else {
        // XXX: not sure if this is the correct logic, but it feel OK
        name = 'options';
      }

      let properties = [];
      if (param.type && param.type.declaration) {
        properties = Array.isArray(param.type.declaration.children)
          ? param.type.declaration.children.map(this._parameter)
          : [];
      } else if (param.type && param.type.type === 'reference') {
        const dataForProperties = dataByKey[param.type.name] || {};
        properties = Array.isArray(dataForProperties.children)
          ? dataForProperties.children.map(this._parameter)
          : [];
      }

      return extend(this._parameter(param), {
        name,
        isOptions: name === 'options',
        optional: !!param.defaultValue,
        properties
      });
    });
  }

  render() {
    const rawData = this.dataByKey[this.props.name];
    const args = this.templateArgs(rawData);
    return (
      <Container>
        <Header>
          <h3 title={args.name} className="title-api selflink" id={args.id}>
            <a href={`#${args.id}`} className="link primary">
              {args.signature}
            </a>
          </h3>
          <div className="subtext-api">
            {args.filepath && (
              <a
                className="src-code link secondary"
                href={`https://github.com/${args.repo}/blob/master/${
                  args.filepath
                }#L${args.lineno}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ({args.filepath}, line {args.lineno})
              </a>
            )}
          </div>
        </Header>
        <Body>
          <p>{args.summary}</p>
          {args.type && <div className="type">{args.type}</div>}
          {args.groups.map((group, index) => (
            <Fragment key={index}>
              <h4 className="subheading">{group.name}</h4>
              <dl className="args">
                {group.members.map((member, index) => (
                  <Fragment key={index}>
                    <dt>
                      <span className="name">{member.name}</span>
                      <span className="type">{member.type}</span>
                    </dt>
                    <dd>{member.description}</dd>
                  </Fragment>
                ))}
              </dl>
            </Fragment>
          ))}
        </Body>
      </Container>
    );
  }
}

export const TypescriptApiBoxContext = createContext();
TypescriptApiBox.contextType = TypescriptApiBoxContext;
