import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { NgRedux, select } from '@angular-redux/store';
import { IAppState } from '../store';
import { EDIT_FILTER_TEXT, TOGGLE_LIST, TOGGLE_MENU, CLOSE_SIDEBARS, CHANGE_LANG } from '../actions';
import { MediaMatcher } from '@angular/cdk/layout';
import _ from 'lodash';
import {DataService} from '../data.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  @select() showList;
  @select() showMenu;
  @select() filterText;
  @select() mode;
  @Output() menuToggle = new EventEmitter<boolean>();
  mobileQuery: MediaQueryList;
  private _mobileQueryListener: () => void;
  public locationOptions = [];

  constructor(changeDetectorRef: ChangeDetectorRef,
              media: MediaMatcher,
              private dataService: DataService,
              private ngRedux: NgRedux<IAppState>) {
    this.mobileQuery = media.matchMedia('(max-width: 900px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  ngOnInit() {
    this.dataService.metadataLoaded.subscribe(()=>{
      // get location information
      this.locationOptions = _.keys(this.dataService.locationInfo);
    })
  }

  toggleMenu(show) {
    this.ngRedux.dispatch({ type: TOGGLE_MENU, payload: show });
    // this.menuToggle.emit(true);
  }

  applyTextFilter(search_text) {
    this.ngRedux.dispatch({ type: EDIT_FILTER_TEXT, text: search_text });
  }

  toggleList(show) {
    this.ngRedux.dispatch({ type: TOGGLE_LIST, payload: show });
  }

  returnToRoot() {
    // close sidebars
    this.ngRedux.dispatch({ type: CLOSE_SIDEBARS });
  }


}
