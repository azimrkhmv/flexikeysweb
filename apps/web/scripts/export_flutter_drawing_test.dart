// Exports the FlexiKeys Flutter app's drawing content (trace + coloring) as JSON for the web app.
// Not a real test: scripts/import-flutter-drawing.py copies it into the Flutter repo's test/ folder,
// runs it with `flutter test` (the data needs package:flutter types) and deletes it again.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flexikeys/data/coloring_items/animals_coloring_data.dart';
import 'package:flexikeys/data/coloring_items/coloring_item_def.dart';
import 'package:flexikeys/data/coloring_items/fruits_coloring_data.dart';
import 'package:flexikeys/data/coloring_items/nature_coloring_data.dart';
import 'package:flexikeys/data/coloring_items/transport_coloring_data.dart';
import 'package:flexikeys/data/trace_items/letters_trace_data.dart';
import 'package:flexikeys/data/trace_items/letters_trace_data_ru.dart';
import 'package:flexikeys/data/trace_items/numbers_trace_data.dart';
import 'package:flexikeys/data/trace_items/objects_trace_data.dart';
import 'package:flexikeys/data/trace_items/trace_item_def.dart';

List<double> _o(Offset o) => [o.dx, o.dy];
List<List<double>> _l(List<Offset> l) => l.map(_o).toList();

Map<String, Object?> _trace(TraceItemDef t) => {
      'label': t.label,
      'ruLabel': t.ruLabel,
      'dots': _l(t.dots),
      'ghost': t.ghost.map(_l).toList(),
    };

Map<String, Object?> _coloring(ColoringItemDef c) => {
      'label': c.label,
      'ruLabel': c.ruLabel,
      if (c.outline != null) 'outline': c.outline!.map(_l).toList(),
      if (c.canvasSize != null) 'size': [c.canvasSize!.width, c.canvasSize!.height],
      if (c.elements != null)
        'elements': c.elements!
            .map((e) => {
                  'model': e.model.name,
                  'points': _l(e.points),
                  if (e.innerPoints != null) 'inner': _l(e.innerPoints!),
                  if (e.holes.isNotEmpty) 'holes': e.holes.map(_l).toList(),
                  'width': e.strokeWidth,
                  'closed': e.closed,
                  'smooth': e.smooth,
                })
            .toList(),
    };

void main() {
  test('export drawing content', () {
    final out = {
      'trace': {
        'letters_latin': kLetterTraceItems.map(_trace).toList(),
        'letters_cyrillic': kLetterTraceItemsRu.map(_trace).toList(),
        'numbers': kNumberTraceItems.map(_trace).toList(),
        'objects': kObjectTraceItems.map(_trace).toList(),
      },
      'coloring': {
        'fruits': kFruitsColoringItems.map(_coloring).toList(),
        'animals': kAnimalsColoringItems.map(_coloring).toList(),
        'nature': kNatureColoringItems.map(_coloring).toList(),
        'transport': kTransportColoringItems.map(_coloring).toList(),
      },
    };
    File(Platform.environment['FK_DRAWING_OUT']!).writeAsStringSync(jsonEncode(out));
  });
}
