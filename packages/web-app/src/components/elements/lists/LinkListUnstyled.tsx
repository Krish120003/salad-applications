import React, { Component } from 'react'

// Store
import { getStore } from '../../../Store'

// UI
import { MenuTitle, Divider } from '../../'

// Packages
import withStyles, { WithStyles } from 'react-jss'
import classnames from 'classnames'

const styles = {
  linkListUnstyled: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  linkListItem: {},
  divider: {
    marginTop: '10px !important',
    marginBottom: '10px !important',
  },
  inset: {
    paddingLeft: 15,
  },
}

interface Props extends WithStyles<typeof styles> {
  list: {
    url: string
    text: string
    /**Should a divider be drawn before this item */
    divider?: boolean
    /** Is the item clickable */
    enabled?: boolean
    inset?: boolean
  }[]
}

class _LinkListUnstyled extends Component<Props> {
  store = getStore()

  render() {
    const { list, classes } = this.props

    return (
      <ul className={classnames('linkListUnstyled', classes.linkListUnstyled)}>
        {list.map((item) => {
          return (
            <React.Fragment key={item.url}>
              {item.divider && <Divider className={classes.divider} />}
              <li className={classnames('linkListItem', classes.linkListItem, { [classes.inset]: item.inset })}>
                <MenuTitle path={item.url} enabled={item.enabled}>
                  {item.text}
                </MenuTitle>
              </li>
            </React.Fragment>
          )
        })}
      </ul>
    )
  }
}

export const LinkListUnstyled = withStyles(styles)(_LinkListUnstyled)
