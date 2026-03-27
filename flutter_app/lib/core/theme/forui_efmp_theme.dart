import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

import 'package:efiling_app/core/theme/efmp_page_transitions.dart';

/// Resolves [FThemeData] for phone vs tablet (touch vs desktop density) and light/dark.
FThemeData resolveEfmpForuiTheme(BuildContext context, Brightness brightness) {
  final shortest = MediaQuery.sizeOf(context).shortestSide;
  final useTouch = shortest < 600;
  if (brightness == Brightness.dark) {
    return useTouch ? FThemes.neutral.dark.touch : FThemes.neutral.dark.desktop;
  }
  return useTouch ? FThemes.neutral.light.touch : FThemes.neutral.light.desktop;
}

/// Material themes derived from Forui so Material widgets stay visually aligned.
ThemeData efmpLightMaterialTheme() {
  return FThemes.neutral.light.touch
      .toApproximateMaterialTheme()
      .copyWith(pageTransitionsTheme: EfmpPageTransitions.theme);
}

ThemeData efmpDarkMaterialTheme() {
  return FThemes.neutral.dark.touch
      .toApproximateMaterialTheme()
      .copyWith(pageTransitionsTheme: EfmpPageTransitions.theme);
}
