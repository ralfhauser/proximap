import {ChangeDetectorRef, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {NgRedux, select} from 'ng2-redux';
import {IAppState} from '../store';
import {EDIT_FILTER_TEXT, TOGGLE_LIST, RETURN_TO_ROOT} from '../actions';
import {MediaMatcher} from '@angular/cdk/layout';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  @select() showList;
  @select() filterText;
  @select() mode;
  @Output() menuToggle = new EventEmitter<boolean>();
  mobileQuery: MediaQueryList;
  private _mobileQueryListener: () => void;

  constructor(changeDetectorRef: ChangeDetectorRef, media: MediaMatcher, private ngRedux: NgRedux<IAppState>) {
    this.mobileQuery = media.matchMedia('(max-width: 900px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  ngOnInit() {
  }

  toggleMenu(){
    this.menuToggle.emit(true);
  }

  applyTextFilter(search_text){
    this.ngRedux.dispatch({type:EDIT_FILTER_TEXT, text: search_text});
  }

  toggleList(show){
    this.ngRedux.dispatch({type:TOGGLE_LIST, payload: show});
  }

  returnToRoot(){
    this.ngRedux.dispatch({type: RETURN_TO_ROOT});
  }
}
