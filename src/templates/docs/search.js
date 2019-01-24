/* global docsearch */
import React, {Component, createRef} from 'react';
import colors from '../../util/colors';
import styled from '@emotion/styled';
import {size} from 'polished';

const borderRadius = 5;
const border = `1px solid ${colors.text3}`;
const verticalAlign = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)'
};

const Hotkey = styled.div(verticalAlign, size(24), {
  border,
  borderColor: colors.text4,
  color: colors.text4,
  borderRadius,
  textAlign: 'center',
  lineHeight: 1.125,
  right: 8,
  pointerEvents: 'none'
});

const Container = styled.div({
  flexGrow: 1,
  maxWidth: 480,
  marginRight: 'auto',
  color: colors.text2,
  position: 'relative',
  '.algolia-autocomplete': {
    width: '100%'
  },
  input: {
    width: '100%',
    height: 40,
    padding: 0,
    paddingLeft: 16,
    border,
    borderRadius,
    fontSize: 14,
    background: 'white',
    outline: 'none',
    ':focus': {
      borderColor: colors.text2
    }
  }
});

// const Overlay = styled.div(position('fixed', 0), {
//   backgroundColor: transparentize(0.5, colors.text2)
// });

// const boxShadowColor = transparentize(0.9, 'black');
// const Results = styled.div({
//   width: 600,
//   maxHeight: 600,
//   marginTop: 14,
//   borderRadius,
//   boxShadow: `${boxShadowColor} 0 2px 12px`,
//   backgroundColor: 'white',
//   overflow: 'auto',
//   position: 'absolute',
//   top: '100%',
//   left: 0
// });

// function preventDefault(event) {
//   event.preventDefault();
// }

export default class Search extends Component {
  state = {
    focused: false,
    value: ''
  };

  input = createRef();

  componentDidMount() {
    window.addEventListener('keydown', this.onKeyDown, true);

    docsearch({
      apiKey: '768e823959d35bbd51e4b2439be13fb7',
      indexName: 'apollodata',
      inputSelector: '#input',
      debug: true
    });
  }

  componentWillUnmount() {
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  onKeyDown = event => {
    // focus the input when the slash key is pressed
    if (
      event.keyCode === 191 &&
      event.target.tagName.toUpperCase() !== 'INPUT'
    ) {
      event.preventDefault();
      this.input.current.focus();
    }
  };

  onChange = event => this.setState({value: event.target.value});

  onFocus = () => this.setState({focused: true});

  onBlur = () => this.setState({focused: false});

  render() {
    return (
      <Container>
        {/* {resultsShown && <Overlay />} */}
        <input
          id="input"
          type="search"
          onFocus={this.onFocus}
          onBlur={this.onBlur}
          onChange={this.onChange}
          value={this.state.value}
          placeholder="Search using Engine"
          ref={this.input}
        />
        {!this.state.focused && !this.state.value && <Hotkey>/</Hotkey>}
      </Container>
    );
  }
}
