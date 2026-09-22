# A tickable row is a checkbox group, never a boolean per row

A list of tickable rows is **one** checkbox group. Every row's input carries the
page's one `name` and a `value` of the row's id, so the form seam reads back a
`string[]` of the ticked ids.

```html
<input type="checkbox" name="item[]" value="skill-a1">
<input type="checkbox" name="item[]" value="skill-a2">
```

Not `name="item-skill-a1"` yielding a boolean each.

## The rule

Whether a box is ticked is **not** in the model. `fill` writes the ticks from
the form's values, so there is one writer and no second copy to disagree with
it. A row's model says what the row *is*, never whether it is chosen.

None ticked means all — which is also what an empty list means in a URL.

## Why

A boolean per row means the model grows a field per row, the template states a
ticked state that the DOM also holds, and the two drift the first time a row
arrives or leaves while the user is mid-selection. A group has one value, in
one place, and the browser maintains it.
