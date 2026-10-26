<?php
/**
 * Plugin Name: 36 Cycling – Formulieren
 * Description: Extra controle op de contactformulieren (Fluent Forms 1, 2, 4, 5): het veld Telefoon ("subject")
 *              accepteert alleen een telefoonnummer (cijfers, spaties, + - ( ) .). Leeg mag. Spambots vullen daar
 *              tekst in ("Hey! Keep up the great work!"); die inzendingen worden geweigerd met een duidelijke melding.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

const C36_FORMS_PHONE = [1 => 'nl', 2 => 'nl', 4 => 'en', 5 => 'en']; // formulier-id => taal van de melding

add_filter('fluentform/validation_errors', function ($errors, $formData, $form, $fields) {
    $id = (int) ($form->id ?? 0);
    if (!isset(C36_FORMS_PHONE[$id])) {
        return $errors;
    }
    $phone = trim((string) ($formData['subject'] ?? ''));
    if ($phone === '') {
        return $errors;
    }
    $digits = preg_replace('/\D/', '', $phone);
    $valid = preg_match('/^[0-9+()\-.\s]{6,25}$/', $phone) && strlen($digits) >= 6;
    if (!$valid) {
        $errors['subject'] = [C36_FORMS_PHONE[$id] === 'en'
            ? 'Please enter a valid phone number, or leave this field empty.'
            : 'Vul een geldig telefoonnummer in, of laat dit veld leeg.'];
    }
    return $errors;
}, 10, 4);
