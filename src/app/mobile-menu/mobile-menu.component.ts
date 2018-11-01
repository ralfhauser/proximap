import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {versions } from '../../environments/versions';

@Component({
  selector: 'app-mobile-menu',
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.css']
})
export class MobileMenuComponent implements OnInit {
  // @select() lang;
  @Output() menuToggle = new EventEmitter<boolean>();
  versionInfo = {
    url: `https://github.com/water-fountains/proximap/commit/${versions.revision}`,
    shorthash: versions.revision,
    time: new Date(versions.time),
    version: versions.version,
    branch: versions.branch
  };



  constructor() {

  }

  toggleMenu(){
    this.menuToggle.emit(true);
  }

  ngOnInit() {
  }

}
