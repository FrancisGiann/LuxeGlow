import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleStarRatingKeyDown } from '../src/utils/ratingKeyboard.js';
import { containAuthDialogFocus } from '../src/utils/authDialogFocus.js';
test('rating arrows wrap, Home/End select boundaries, and ordinary Tab remains native', () => {
  for (const [key,value,next] of [['ArrowRight',5,1],['ArrowDown',2,3],['ArrowLeft',1,5],['ArrowUp',4,3],['Home',4,1],['End',null,5],['ArrowRight',null,2]]) {
    let selected,focused,prevented=false;
    handleStarRatingKeyDown({key,preventDefault(){prevented=true;},currentTarget:{querySelectorAll(){return [1,2,3,4,5].map(i=>({focus(){focused=i;}}));}}},value,v=>selected=v);
    assert.equal(selected,next);assert.equal(focused,next);assert.equal(prevented,true);
  }
  handleStarRatingKeyDown({key:'Tab',preventDefault(){throw Error('Tab consumed');}},3,()=>assert.fail('changed on Tab'));
});
test('loading/empty rating dialog focuses Close, contains one control, and restores its invoker', () => {
  let handler,closed=0;
  const doc={activeElement:null,addEventListener(_key,h){handler=h;},removeEventListener(){handler=null;}};
  const control=()=>({tagName:'BUTTON',tabIndex:0,isConnected:true,getClientRects(){return [{}];},focus(){doc.activeElement=this;}});
  const trigger=control(),close=control();doc.activeElement=trigger;
  const dialog={ownerDocument:doc,querySelectorAll(){return [close];},contains(e){return e===close;}};
  const release=containAuthDialogFocus(dialog,()=>closed++);assert.equal(doc.activeElement,close);
  for(const shiftKey of [true,false]){let prevented=false;handler({key:'Tab',shiftKey,preventDefault(){prevented=true;},stopPropagation(){}});assert.equal(prevented,true);assert.equal(doc.activeElement,close);}
  handler({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(closed,1);release();assert.equal(doc.activeElement,trigger);assert.equal(handler,null);
});
test('dialog retains API submission while adding name, focus containment and mobile targets', () => {
  const source=readFileSync(new URL('../src/components/dashboard/RateVisitModal.jsx',import.meta.url),'utf8');
  assert.match(source,/aria-labelledby=\{titleId\}/);assert.match(source,/id=\{titleId\}/);
  assert.match(source,/containAuthDialogFocus\(dialogRef.current/);assert.match(source,/overflow = previousOverflow/);
  assert.match(source,/min-h-11 min-w-11/);assert.match(source,/h-11 w-11/);
  assert.match(source,/createReview\(appointmentId, rating, staffRating, text.trim\(\)\)/);
});
