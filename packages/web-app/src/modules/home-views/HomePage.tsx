import React, { Component } from 'react'
import { SaladTheme } from '../../SaladTheme'
import withStyles, { WithStyles } from 'react-jss'
import classnames from 'classnames'
import { ExperienceBarContainer, SlicedVeggieContainer } from '../xp-views'
import { RewardListContainer, RewardFilterContainer, SelectedRewardContainer } from '../reward-views'
import { RefreshService } from '../data-refresh'
import { getStore } from '../../Store'
import { BottomBarContainer } from './BottomBarContainer'
import { MenuBarContainer } from './MenuBarContainer'
import { ProfileMenuItemContainer } from '../profile-views'
import { StartButtonContainer } from '../machine-views'
import { Fade } from '../../components'

const styles = (theme: SaladTheme) => ({
  container: {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    zIndex: 2000,
  },
  headerFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100px',
    zIndex: 1000,
  },
  main: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'stretch',
    flex: 1,
  },
  mainColumn: {},
  verticalLayout: {
    display: 'flex',
    flexDirection: 'column',
  },
  footer: {
    flex: 'none',
  },
})

class _HomePage extends Component<WithStyles<typeof styles>> {
  refreshService: RefreshService

  constructor(props: any) {
    super(props)
    let store = getStore()
    this.refreshService = new RefreshService(store)
  }

  componentDidMount() {
    this.refreshService.start()
  }

  componentWillUnmount() {
    this.refreshService.stop()
  }

  render() {
    const { classes } = this.props
    return (
      <div className={classes.container}>
        <Fade className={classnames(classes.headerFade)} direction="down" />
        <div className={classes.header}>
          <ProfileMenuItemContainer />
          <div style={{ flexGrow: 1 }}>
            <MenuBarContainer />
          </div>
          <div>
            <StartButtonContainer />
          </div>
        </div>

        <div className={classes.main}>
          <div className={classnames(classes.mainColumn, classes.verticalLayout)}>
            <ExperienceBarContainer />
          </div>
          <div className={classnames(classes.mainColumn)}>
            <SlicedVeggieContainer />
          </div>

          <div className={classnames(classes.mainColumn, classes.verticalLayout)}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
              <SelectedRewardContainer />
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'stretch',
                  flexDirection: 'row',
                }}
              >
                <RewardFilterContainer />
                <RewardListContainer />
              </div>
            </div>
          </div>
        </div>

        <div className={classes.footer}>
          <BottomBarContainer />
        </div>
      </div>
    )
  }
}

export const HomePage = withStyles(styles)(_HomePage)